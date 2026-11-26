import { Hono } from 'hono';
import { verifyUser } from '../lib/auth';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string; };

export const profiles = new Hono<{ Bindings: Bindings }>();

function toProfileJson(row: any) {
  return {
    $id: row.user_id,
    userId: row.user_id,
    displayName: row.display_name,
    userName: row.user_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    bannerTheme: row.banner_theme,
    homeDistrict: row.home_district,
    joinedAT: row.joined_at,
    handle: row.handle || null,
  };
}

// GET /profiles/handle/:handle -- look a profile up by its @handle.
profiles.get('/handle/:handle', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM profiles WHERE handle = ? COLLATE NOCASE').bind(c.req.param('handle')).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(toProfileJson(row));
});

// GET /profiles/:userId  (?stats=1 adds story, Flash News, comment and
// follower counts for the public profile page; no private data).
profiles.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  let row: any = await c.env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(userId).first();
  if (!row && c.req.query('stats') === '1') {
    // People who never filled in a profile still have a public page.
    const u = await c.env.DB.prepare('SELECT id, name, created_at FROM users WHERE id = ?').bind(userId).first<any>();
    if (u) row = { user_id: u.id, display_name: u.name, joined_at: u.created_at };
  }
  if (!row) return c.json({ error: 'Not found' }, 404);
  const json: Record<string, unknown> = toProfileJson(row);
  if (c.req.query('stats') === '1') {
    const s = await c.env.DB
      .prepare(`SELECT
        (SELECT COUNT(*) FROM articles WHERE submitter_id = ?1 AND status = 'published' AND kind = 'story') AS stories,
        (SELECT COUNT(*) FROM articles WHERE submitter_id = ?1 AND status = 'published' AND kind = 'flash') AS flash,
        (SELECT COUNT(*) FROM comments WHERE user_id = ?1) AS comments,
        (SELECT COUNT(*) FROM follows WHERE following_id = ?1) AS followers,
        (SELECT name FROM users WHERE id = ?1) AS account_name,
        (SELECT created_at FROM users WHERE id = ?1) AS account_created,
        (SELECT labels FROM users WHERE id = ?1) AS labels`)
      .bind(userId)
      .first<any>();
    json.stats = { stories: s?.stories || 0, flash: s?.flash || 0, comments: s?.comments || 0, followers: s?.followers || 0 };
    if (!json.displayName) json.displayName = s?.account_name || null;
    if (!json.joinedAT) json.joinedAT = s?.account_created || null;
    try {
      const labels = JSON.parse(s?.labels || '[]');
      json.isStaff = labels.includes('admin') || labels.includes('reporter');
    } catch {
      json.isStaff = false;
    }
  }
  return c.json(json);
});

// POST /profiles  { userId, displayName?, userName?, bio?, avatarUrl?,
// coverUrl?, bannerTheme?, homeDistrict? } -- own-user only. Partial: only
// the fields present in the body are touched, so this covers everything
// from a full profile-editor save (ProfileEditor.tsx) down to a
// single-field update (auth/page.tsx's signup, HomeClient.tsx's
// profile-completion prompt) without either clobbering fields the caller
// didn't send. user_id is the real PRIMARY KEY (no separate docId lookup
// needed, unlike the old Appwrite version's list-then-create-or-update
// dance) -- an INSERT ... ON CONFLICT DO UPDATE upsert either creates the
// row (setting joined_at once) or updates only the given columns.
const PROFILE_FIELD_MAP: Record<string, string> = {
  displayName: 'display_name', userName: 'user_name', bio: 'bio',
  avatarUrl: 'avatar_url', coverUrl: 'cover_url', bannerTheme: 'banner_theme',
  homeDistrict: 'home_district', handle: 'handle',
};

const HANDLE_RE = /^[a-z0-9_.]{3,30}$/;
const RESERVED_HANDLES = new Set(['admin', 'khabar', 'khabardarjeeling', 'support', 'editor', 'reporter', 'official']);
profiles.post('/', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  const body = await c.req.json().catch(() => null);
  if (!body?.userId) return c.json({ error: 'userId is required' }, 400);
  if (!user || user.$id !== body.userId) return c.json({ error: 'Unauthorized' }, 401);

  // Light validation so profiles stay readable and nobody takes another
  // person's @handle.
  if (body.displayName !== undefined) {
    body.displayName = String(body.displayName || '').trim().slice(0, 60);
    if (!body.displayName) return c.json({ error: 'Name cannot be empty.' }, 400);
  }
  if (body.bio !== undefined) body.bio = String(body.bio || '').slice(0, 300);
  if (body.handle !== undefined) {
    const h = String(body.handle || '').trim().replace(/^@/, '').toLowerCase();
    if (!h) {
      body.handle = null;
    } else {
      if (!HANDLE_RE.test(h)) return c.json({ error: 'Usernames are 3–30 letters, numbers, dots or underscores.', code: 'BAD_HANDLE' }, 400);
      if (RESERVED_HANDLES.has(h)) return c.json({ error: 'That username is reserved.', code: 'HANDLE_TAKEN' }, 409);
      const taken = await c.env.DB.prepare('SELECT user_id FROM profiles WHERE handle = ? COLLATE NOCASE AND user_id <> ?').bind(h, body.userId).first();
      if (taken) return c.json({ error: 'That username is taken.', code: 'HANDLE_TAKEN' }, 409);
      body.handle = h;
    }
  }

  const cols = ['user_id'];
  const placeholders = ['?'];
  const params: unknown[] = [body.userId];
  const updates: string[] = [];
  for (const [key, column] of Object.entries(PROFILE_FIELD_MAP)) {
    if (body[key] === undefined) continue;
    cols.push(column);
    placeholders.push('?');
    params.push(body[key]);
    updates.push(`${column} = excluded.${column}`);
  }
  if (updates.length === 0) return c.json({ error: 'No recognized fields in body' }, 400);

  const sql = `INSERT INTO profiles (${cols.join(', ')}, joined_at) VALUES (${placeholders.join(', ')}, datetime('now'))
    ON CONFLICT (user_id) DO UPDATE SET ${updates.join(', ')}`;
  await c.env.DB.prepare(sql).bind(...params).run();
  return c.json({ ok: true });
});
