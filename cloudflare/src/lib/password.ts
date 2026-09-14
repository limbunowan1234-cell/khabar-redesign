// Password hashing for the D1-native auth system (see the migration plan
// in the repo root's plan history -- this replaces Appwrite Auth, which
// went dark project-wide behind a billing_limit_exceeded 402).
//
// PBKDF2-HMAC-SHA256 via Web Crypto (crypto.subtle) -- the only hashing
// primitive available in the Workers runtime without pulling in a WASM
// dependency (no Node crypto, no native bcrypt).
//
// Iteration count is versioned INSIDE the stored hash string
// ("pbkdf2-sha256$<iterations>$<salt>$<hash>"), not hardcoded at verify
// time, so it can be raised later (OWASP's current guidance for
// PBKDF2-SHA256 is 600,000) without a migration -- verifyPassword already
// reads whatever count a given hash was created with. 100,000 is the
// starting default: comfortably inside the Workers Free plan's 10ms CPU
// budget with headroom. If khabar-worker is confirmed to be on the Paid
// plan (30s CPU limit), raise DEFAULT_ITERATIONS and let successful logins
// rehash going forward -- see hashPassword's call sites.

const ALGO = 'pbkdf2-sha256';
const DEFAULT_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

// Constant-time-ish string compare -- avoids leaking hash-match progress
// via early-exit timing. Not perfect (JS engines can still optimize), but
// standard practice for this without a dedicated crypto.subtle helper.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, keyMaterial, KEY_BITS
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await deriveBits(password, salt, iterations);
  return `${ALGO}$${iterations}$${toB64(salt)}$${toB64(bits)}`;
}

// Returns false (not an error) for null/malformed/wrong-algo hashes --
// callers treat "no valid hash" and "wrong password" identically, same as
// Appwrite did (never reveals which case it was).
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const [algo, iterStr, saltB64, hashB64] = parts;
  if (algo !== ALGO) return false;
  const iterations = parseInt(iterStr, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  try {
    const bits = await deriveBits(password, fromB64(saltB64), iterations);
    return timingSafeEqual(toB64(bits), hashB64);
  } catch {
    return false;
  }
}
