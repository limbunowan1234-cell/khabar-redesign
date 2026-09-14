// Server-side (Next.js API route) verification of the access JWTs minted
// by the Worker's POST /auth/token (see cloudflare/src/routes/auth.ts,
// cloudflare/src/lib/jwt.ts). Verifies locally with the same
// AUTH_JWT_SECRET the Worker holds -- no round-trip to anything -- which
// is what every one of these ~9 admin API routes used to do against
// Appwrite's own /account endpoint (each with its own copy-pasted
// checkAdminJwt(), before Appwrite went dark behind a billing_limit_
// exceeded 402). Consolidated into one shared helper here.
//
// Needs process.env.AUTH_JWT_SECRET set to the exact same value as the
// Worker's AUTH_JWT_SECRET secret (`wrangler secret put`) -- these two
// have to match byte-for-byte for a token signed by one to verify
// against the other.

interface AccessClaims {
  sub: string;
  email: string;
  name: string;
  labels: string[];
  iat: number;
  exp: number;
  jti: string;
}

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  // Buffer.from(...) returns a Buffer view over a possibly-shared
  // ArrayBufferLike, which the DOM lib's BufferSource type (crypto.subtle
  // calls) doesn't accept -- copy into a plain Uint8Array/ArrayBuffer.
  return new Uint8Array(Buffer.from(s, 'base64'));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    console.error('DEBUG_AUTH: AUTH_JWT_SECRET is not set in this environment');
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('DEBUG_AUTH: token does not have 3 parts, got', parts.length);
    return null;
  }
  const [header, body, signature] = parts;

  try {
    // Cast to BufferSource: this TS lib's ArrayBufferView is generic over
    // ArrayBuffer specifically, and both Uint8Array-producing calls below
    // are typed against the wider ArrayBufferLike -- functionally fine at
    // runtime (Web Crypto only cares about the byte contents), just a lib
    // type mismatch.
    const ok = await crypto.subtle.verify(
      'HMAC', await hmacKey(secret), b64urlToBytes(signature) as BufferSource, new TextEncoder().encode(`${header}.${body}`) as BufferSource
    );
    if (!ok) {
      console.error('DEBUG_AUTH: signature verification failed, secret length', secret.length);
      return null;
    }

    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as AccessClaims;
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) {
      console.error('DEBUG_AUTH: exp check failed', claims.exp, Math.floor(Date.now() / 1000));
      return null;
    }
    return claims;
  } catch (e) {
    console.error('DEBUG_AUTH: exception', e);
    return null;
  }
}

const ADMIN_EMAIL = 'nowanad@gmail.com';

export function isAdminClaims(claims: AccessClaims | null): boolean {
  if (!claims) return false;
  return claims.email?.toLowerCase() === ADMIN_EMAIL || (claims.labels || []).includes('admin');
}

// Drop-in replacement for every route's old `checkAdminJwt(jwt)` -- same
// signature, same meaning ("is this bearer token an admin's"), just
// verified locally now instead of against Appwrite.
export async function checkAdminJwt(jwt: string | null): Promise<boolean> {
  if (!jwt) return false;
  const claims = await verifyAccessToken(jwt);
  return isAdminClaims(claims);
}
