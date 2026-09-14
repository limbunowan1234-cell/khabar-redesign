// Short-lived access-token signing/verification for the D1-native auth
// system. HS256 (HMAC-SHA256) via Web Crypto -- fully local, no network
// round-trip -- unlike the Appwrite-proxy verifyUser() this replaces,
// which had to live-fetch Appwrite's own /account endpoint on every single
// call. Signed and verified with one shared secret (AUTH_JWT_SECRET,
// a Worker secret, also held by Next.js as a Vercel env var for the ~9
// admin API routes that verify these tokens server-side without going
// through the Worker at all -- see lib/serverAuth.ts on the Next.js side).
//
// 15-minute expiry matches the TTL Appwrite's own POST /account/jwts used
// -- this is the bearer token lib/appwrite.ts's getWorkerAuthToken() mints
// fresh from the (separate, longer-lived) refresh-session cookie on each
// use; it is intentionally NOT the thing that makes "logout" work -- see
// routes/auth.ts's session/cookie handling for that.

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

export interface AccessClaims {
  sub: string;
  email: string;
  name: string;
  labels: string[];
  iat: number;
  exp: number;
  jti: string;
}

export async function signAccessToken(
  claims: Pick<AccessClaims, 'sub' | 'email' | 'name' | 'labels'>,
  secret: string,
  ttlSeconds = 900
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessClaims = { ...claims, iat: now, exp: now + ttlSeconds, jti: crypto.randomUUID() };
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    'HMAC', await hmacKey(secret), new TextEncoder().encode(`${header}.${body}`)
  );
  return `${header}.${body}.${b64url(new Uint8Array(signature))}`;
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  try {
    const ok = await crypto.subtle.verify(
      'HMAC', await hmacKey(secret), b64urlToBytes(signature), new TextEncoder().encode(`${header}.${body}`)
    );
    if (!ok) return null;

    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as AccessClaims;
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}
