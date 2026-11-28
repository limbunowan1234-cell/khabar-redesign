// Verifies "who is asking" for endpoints that need to know. Previously
// proxied every check to Appwrite's own /account endpoint server-to-server
// -- replaced with fully local JWT verification (see lib/jwt.ts) after
// Appwrite Cloud's billing_limit_exceeded 402 took the whole project down,
// including auth. See the migration plan and routes/auth.ts for the full
// design.
//
// Exported function names/signatures are kept as close as possible to the
// old Appwrite-proxy version specifically so the ~19 route files that
// import verifyUser/isAdmin/isReporterOrAdmin/isPhotographer/verifyService
// didn't need their own logic touched -- only verifyUser()'s call sites
// needed `c.req.raw` -> `c.req.raw, c.env` (it now needs AUTH_JWT_SECRET
// to verify locally, where the old version needed nothing but the request
// itself since Appwrite held the secret).

import { verifyAccessToken } from './jwt';

export interface AppUser {
  $id: string;
  name: string;
  email: string;
  labels?: string[];
}

// Returns the verified user for the request's `Authorization: Bearer <jwt>`
// header, or null if there's no token or it's invalid/expired. Never
// throws -- callers treat null as "anonymous."
export async function verifyUser(request: Request, env: { AUTH_JWT_SECRET: string }): Promise<AppUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) return null;

  const claims = await verifyAccessToken(jwt, env.AUTH_JWT_SECRET);
  if (!claims) return null;
  return { $id: claims.sub, name: claims.name, email: claims.email, labels: claims.labels };
}

// Matches the ADMIN_EMAIL / labels.includes('admin') check every client
// component and admin API route already uses.
export function isAdmin(user: AppUser | null): boolean {
  if (!user) return false;
  return user.email?.toLowerCase() === 'nowanad@gmail.com' || (user.labels || []).includes('admin');
}

// Matches app/admin/page.tsx's "Reporter or Admin only" gate -- broader
// than isAdmin(), since reporters manage articles too (breaking/featured/
// contest flags, weekly picks) without being full admins.
export function isReporterOrAdmin(user: AppUser | null): boolean {
  if (!user) return false;
  return isAdmin(user) || (user.labels || []).includes('reporter');
}

// Family Reunion case team (src/routes/reunion.ts): admins plus users given
// the "reunion" label. Deliberately not granted to every reporter -- cases
// hold private family details and informants' contact information.
export function isReunionStaff(user: AppUser | null): boolean {
  if (!user) return false;
  return isAdmin(user) || (user.labels || []).includes('reunion');
}

// Matches app/hills-in-frame/post/page.tsx's own gate -- a separate role
// from reporter/admin, for Hills in Frame photo submissions specifically.
export function isPhotographer(user: AppUser | null): boolean {
  if (!user) return false;
  return (user.labels || []).includes('photographer');
}

// For requests that aren't on behalf of the caller's own account at all --
// app/api/send-notification/route.ts creates notifications for, and reads
// push subscriptions for, whichever user triggered some *other* user's
// action (e.g. commenting on their article), so a per-user JWT can't apply.
// A shared secret, sent only server-to-server, stands in for "this really
// is our own trusted backend". Unrelated to the auth migration -- unchanged.
export function verifyService(request: Request, env: { SERVICE_SECRET?: string }): boolean {
  const secret = request.headers.get('X-Service-Secret');
  return !!env.SERVICE_SECRET && secret === env.SERVICE_SECRET;
}

// Publishing ban. An admin adds the label "suspended" to a user (users.labels)
// and that account can no longer create or edit articles, comments or
// uploads. Checked against the database on every write, not the JWT's own
// labels claim, so a suspension takes effect at once instead of when the
// user's 15-minute token expires.
export async function isSuspended(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare('SELECT labels FROM users WHERE id = ?').bind(userId).first<{ labels: string }>();
  if (!row) return false;
  try {
    return (JSON.parse(row.labels || '[]') as string[]).includes('suspended');
  } catch {
    return false;
  }
}
