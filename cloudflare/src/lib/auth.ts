// Verifies "who is asking" for endpoints that need to know, without the
// Worker ever holding a password or session cookie of its own. Appwrite's
// session cookie is scoped to its own domain and is HttpOnly, so it never
// reaches this Worker's domain automatically -- the client instead mints a
// short-lived JWT (POST /account/jwts, using its existing Appwrite
// session) and sends that to us. We hand the JWT back to Appwrite
// server-to-server to confirm it's real and find out whose it is. Used by
// GET /articles?status=all and by every shadow-write endpoint (likes,
// bookmarks, follows, comments) to confirm the caller is who they claim.
// See cloudflare/README.md for the full flow.

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

// Matches the ADMIN_EMAIL / labels.includes('admin') check every client
// component and admin API route already uses.
export function isAdmin(user: AppwriteUser | null): boolean {
  if (!user) return false;
  return user.email?.toLowerCase() === 'nowanad@gmail.com' || (user.labels || []).includes('admin');
}

// Matches app/admin/page.tsx's "Reporter or Admin only" gate -- broader
// than isAdmin(), since reporters manage articles too (breaking/featured/
// contest flags, weekly picks) without being full admins.
export function isReporterOrAdmin(user: AppwriteUser | null): boolean {
  if (!user) return false;
  return isAdmin(user) || (user.labels || []).includes('reporter');
}

// Matches app/hills-in-frame/post/page.tsx's own gate -- a separate role
// from reporter/admin, for Hills in Frame photo submissions specifically.
export function isPhotographer(user: AppwriteUser | null): boolean {
  if (!user) return false;
  return (user.labels || []).includes('photographer');
}

// For requests that aren't on behalf of the caller's own account at all --
// app/api/send-notification/route.ts creates notifications for, and reads
// push subscriptions for, whichever user triggered some *other* user's
// action (e.g. commenting on their article), so a per-user JWT can't apply.
// A shared secret, sent only server-to-server, stands in for "this really
// is our own trusted backend" the same way the Appwrite API key already
// does on the Vercel side of that same route.
export function verifyService(request: Request, env: { SERVICE_SECRET?: string }): boolean {
  const secret = request.headers.get('X-Service-Secret');
  return !!env.SERVICE_SECRET && secret === env.SERVICE_SECRET;
}
