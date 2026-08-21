// Verifies "who is asking" for endpoints that need to know, without the
// Worker ever holding a password or session cookie of its own. Appwrite's
// session cookie is scoped to its own domain and is HttpOnly, so it never
// reaches this Worker's domain automatically -- the client instead mints a
// short-lived JWT (POST /account/jwts, using its existing Appwrite
// session) and sends that to us. We hand the JWT back to Appwrite
// server-to-server to confirm it's real and find out whose it is. See
// cloudflare/README.md for the full flow and why writes still don't use
// this yet (shadow-write validation hasn't happened).

const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT = 'khabardarjeeling';

export interface AppwriteUser {
  $id: string;
  name: string;
  email: string;
  labels?: string[];
}

// Returns the verified user for the request's `Authorization: Bearer <jwt>`
// header, or null if there's no token or Appwrite rejects it (expired,
// malformed, revoked). Never throws -- callers treat null as "anonymous."
export async function verifyUser(request: Request): Promise<AppwriteUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) return null;

  try {
    const res = await fetch(`${APPWRITE_ENDPOINT}/account`, {
      headers: {
        'X-Appwrite-Project': APPWRITE_PROJECT,
        'X-Appwrite-JWT': jwt,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as AppwriteUser;
  } catch {
    return null;
  }
}
