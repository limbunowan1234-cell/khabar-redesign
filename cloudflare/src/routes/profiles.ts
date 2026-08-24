import { Hono } from 'hono';
import { verifyUser } from '../lib/auth';

type Bindings = { DB: D1Database };

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
  };
}

// GET /profiles/:userId
profiles.get('/:userId', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(c.req.param('userId')).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(toProfileJson(row));
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
  homeDistrict: 'home_district',
};
profiles.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const body = await c.req.json().catch(() => null);
  if (!body?.userId) return c.json({ error: 'userId is required' }, 400);
  if (!user || user.$id !== body.userId) return c.json({ error: 'Unauthorized' }, 401);

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
