import { Hono } from 'hono';
import { hashPassword, verifyPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { sendPasswordResetEmail } from '../lib/email';
import { verifyUser, isAdmin } from '../lib/auth';

// Replaces Appwrite Auth entirely -- see the migration plan for why
// (Appwrite Cloud's billing_limit_exceeded 402 blocked the whole project,
// including auth, and the site owner won't pay to fix a Storage-quota
// problem on a migration that was already complete everywhere else).
//
// Two-tier session model, matching Appwrite's own shape so the frontend's
// getWorkerAuthToken()-then-Bearer-JWT pattern needs no logic changes:
//   - A long-lived (30-day) opaque refresh session, held in an HttpOnly
//     cookie on this domain, verified against D1's sessions table.
//   - A short-lived (15-min) signed access JWT, minted from that cookie on
//     demand via POST /auth/token, sent as `Authorization: Bearer <jwt>`
//     to every other authenticated Worker route (see lib/jwt.ts +
//     lib/auth.ts's verifyUser()).

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string; RESEND_API_KEY?: string };
export const auth = new Hono<{ Bindings: Bindings }>();

const REFRESH_COOKIE = 'kd_session';
const REFRESH_TTL_DAYS = 30;
const RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h -- 1h (Appwrite's own default) was too easy to miss, especially for the mass recovery-campaign emails going to inboxes people don't check right away

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(bytes = 32): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Matches the {$id, name, email, labels} shape every existing client call
// site already expects from Appwrite's /account response -- see lib/auth.ts's
// AppUser interface and every isAdmin()/isReporterOrAdmin()/isPhotographer()
// caller across the app.
function toUserJson(row: any) {
  return { $id: row.id, name: row.name, email: row.email, labels: JSON.parse(row.labels || '[]') };
}

async function createSession(env: Bindings, userId: string, req: Request): Promise<{ raw: string; expires: string }> {
  const raw = randomToken();
  const hash = await sha256Hex(raw);
  const expires = new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, refresh_hash, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), userId, hash, expires, req.headers.get('User-Agent') || null).run();
  return { raw, expires };
}

function sessionCookie(raw: string): string {
  const maxAge = REFRESH_TTL_DAYS * 86400;
  return `${REFRESH_COOKIE}=${raw}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function clearSessionCookie(): string {
  return `${REFRESH_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(c: any, name: string): string | null {
  const cookie = c.req.header('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function currentSessionUser(c: any): Promise<{ user: any; sessionRawHash: string } | null> {
  const raw = readCookie(c, REFRESH_COOKIE);
  if (!raw) return null;
  const hash = await sha256Hex(raw);
  const session = await c.env.DB.prepare(
    "SELECT * FROM sessions WHERE refresh_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')"
  ).bind(hash).first() as any;
  if (!session) return null;
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first() as any;
  if (!user) return null;
  return { user, sessionRawHash: hash };
}

// POST /auth/signup  { email, password, name, homeDistrict? }
// Two behaviors beyond a faithful port of the old flow (see migration
// plan): creates the D1 profiles row server-side in the same request
// (the old client-side 3-step dance silently no-op'd on failure), and if
// the email matches an already-migrated row with no password set yet,
// claims/completes that row instead of erroring -- a safety net for
// anyone the reset-email campaign misses, preserving their original id
// (and therefore their post/like/comment/follow history).
auth.post('/signup', async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = body?.email?.trim();
  const password = body?.password;
  const name = body?.name?.trim();
  const homeDistrict = body?.homeDistrict;
  if (!email || !password || !name) return c.json({ error: 'email, password and name are required' }, 400);
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

  const existing = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ? COLLATE NOCASE')
    .bind(email).first() as any;

  let userId: string;
  if (existing) {
    if (existing.password_hash) return c.json({ error: 'An account with this email already exists' }, 409);
    userId = existing.id;
    await c.env.DB.prepare(
      "UPDATE users SET password_hash = ?, name = ?, needs_password_reset = 0, updated_at = datetime('now') WHERE id = ?"
    ).bind(await hashPassword(password), name, userId).run();
  } else {
    userId = crypto.randomUUID();
    await c.env.DB.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
      .bind(userId, email, await hashPassword(password), name).run();
  }

  if (homeDistrict) {
    await c.env.DB.prepare(
      `INSERT INTO profiles (user_id, display_name, user_name, home_district, joined_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT (user_id) DO UPDATE SET home_district = excluded.home_district`
    ).bind(userId, name, name, homeDistrict).run();
  }

  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any;
  const { raw } = await createSession(c.env, userId, c.req.raw);
  c.header('Set-Cookie', sessionCookie(raw));
  return c.json(toUserJson(row));
});

// POST /auth/login  { email, password }
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = body?.email?.trim();
  const password = body?.password;
  if (!email || !password) return c.json({ error: 'email and password are required' }, 400);

  const row = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').bind(email).first() as any;
  if (!row) return c.json({ error: 'Invalid email or password' }, 401);
  if (!row.password_hash) {
    return c.json({
      error: "We've upgraded our login system. Please reset your password using the link we emailed you, or request a new one below.",
      code: 'NEEDS_RESET',
    }, 401);
  }
  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return c.json({ error: 'Invalid email or password' }, 401);

  const { raw } = await createSession(c.env, row.id, c.req.raw);
  c.header('Set-Cookie', sessionCookie(raw));
  return c.json(toUserJson(row));
});

// GET /auth/me -- cookie-based, replaces GET /account
auth.get('/me', async (c) => {
  const result = await currentSessionUser(c);
  if (!result) return c.json({ error: 'Unauthorized' }, 401);
  return c.json(toUserJson(result.user));
});

// POST /auth/token -- cookie-based, mints the short-lived Bearer JWT.
// Replaces POST /account/jwts; this is exactly what
// lib/appwrite.ts's getWorkerAuthToken() calls.
auth.post('/token', async (c) => {
  const result = await currentSessionUser(c);
  if (!result) return c.json({ error: 'Unauthorized' }, 401);
  const jwt = await signAccessToken({
    sub: result.user.id,
    email: result.user.email,
    name: result.user.name,
    labels: JSON.parse(result.user.labels || '[]'),
  }, c.env.AUTH_JWT_SECRET);
  return c.json({ jwt });
});

// POST /auth/logout
auth.post('/logout', async (c) => {
  const raw = readCookie(c, REFRESH_COOKIE);
  if (raw) {
    const hash = await sha256Hex(raw);
    await c.env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE refresh_hash = ?").bind(hash).run();
  }
  c.header('Set-Cookie', clearSessionCookie());
  return c.json({ ok: true });
});

// POST /auth/request-password-reset  { email }
// Always 200 with a generic message regardless of whether the email
// exists or the send succeeds -- matches Appwrite's own non-enumerating
// /account/recovery behavior.
auth.post('/request-password-reset', async (c) => {
  const body = await c.req.json().catch(() => null);
  const email = body?.email?.trim();
  if (email) {
    const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').bind(email).first() as any;
    if (user) {
      const raw = randomToken();
      const hash = await sha256Hex(raw);
      const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
      await c.env.DB.prepare(
        'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), user.id, hash, expires).run();
      await sendPasswordResetEmail(c.env, email, raw);
    }
  }
  return c.json({ ok: true });
});

// POST /auth/reset-password  { token, password }
auth.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => null);
  const token = body?.token;
  const password = body?.password;
  if (!token || !password) return c.json({ error: 'token and password are required' }, 400);
  if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

  const hash = await sha256Hex(token);
  const record = await c.env.DB.prepare(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')"
  ).bind(hash).first() as any;
  if (!record) return c.json({ error: 'This reset link is invalid or has expired.' }, 400);

  await c.env.DB.prepare(
    "UPDATE users SET password_hash = ?, needs_password_reset = 0, updated_at = datetime('now') WHERE id = ?"
  ).bind(await hashPassword(password), record.user_id).run();
  await c.env.DB.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").bind(record.id).run();
  // Invalidate existing sessions on password change -- standard practice;
  // Appwrite achieves the same end result implicitly (old sessions aren't
  // reissued after a recovery completes).
  await c.env.DB.prepare(
    "UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL"
  ).bind(record.user_id).run();
  return c.json({ ok: true });
});

// GET /auth/admin/search-accounts?q=<name>
// Finds candidates for manual account recovery -- pre-auth-migration
// commenters/likers who have a `profiles` row (a real identity on the
// site) but no email anywhere in D1, so the normal email-based
// self-serve recovery (signup-claims-existing-row, or a reset link)
// can't reach them. Search by display name; the admin cross-checks the
// bio/join date against whoever is asking to confirm it's really them
// (there's no automated proof of identity possible here -- see
// POST /auth/admin/link-account below), then links their real email.
auth.get('/admin/search-accounts', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!isAdmin(user)) return c.json({ error: 'Admin access required' }, 403);

  const q = c.req.query('q')?.trim();
  if (!q) return c.json({ error: 'q is required' }, 400);

  const { results } = await c.env.DB.prepare(
    `SELECT p.user_id, p.display_name, p.bio, p.avatar_url, p.home_district, p.joined_at,
            (SELECT id FROM users WHERE id = p.user_id) as existing_users_id
     FROM profiles p WHERE p.display_name LIKE ? LIMIT 20`
  ).bind(`%${q}%`).all();

  const candidates = (results || []).map((r: any) => ({
    userId: r.user_id,
    displayName: r.display_name,
    bio: r.bio,
    avatarUrl: r.avatar_url,
    homeDistrict: r.home_district,
    joinedAt: r.joined_at,
    alreadyLinked: !!r.existing_users_id,
  }));
  return c.json({ candidates });
});

// POST /auth/admin/link-account  { userId, email, name? }
// Creates the users row an already-existing profile never got (no email
// was ever recoverable for it), preserving the original user_id so
// their existing comments/likes/profile stay attached -- then sends the
// normal password-reset email so they set their own password. Trust in
// the email being correct rests entirely on the admin having verified
// this out-of-band (see search-accounts above); there is no other proof
// of identity available for these accounts.
auth.post('/admin/link-account', async (c) => {
  const admin = await verifyUser(c.req.raw, c.env);
  if (!isAdmin(admin)) return c.json({ error: 'Admin access required' }, 403);

  const body = await c.req.json().catch(() => null);
  const userId = body?.userId?.trim();
  const email = body?.email?.trim();
  if (!userId || !email) return c.json({ error: 'userId and email are required' }, 400);

  const profile = await c.env.DB.prepare('SELECT display_name FROM profiles WHERE user_id = ?').bind(userId).first() as any;
  if (!profile) return c.json({ error: 'No profile found for this userId' }, 404);

  const existingById = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (existingById) return c.json({ error: 'This account is already linked to an email' }, 409);

  const existingByEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  if (existingByEmail) return c.json({ error: 'That email is already in use by another account' }, 409);

  const name = body?.name?.trim() || profile.display_name || 'User';
  await c.env.DB.prepare(
    'INSERT INTO users (id, email, name, needs_password_reset) VALUES (?, ?, ?, 1)'
  ).bind(userId, email, name).run();

  const raw = randomToken();
  const hash = await sha256Hex(raw);
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), userId, hash, expires).run();
  await sendPasswordResetEmail(c.env, email, raw);

  return c.json({ ok: true });
});
