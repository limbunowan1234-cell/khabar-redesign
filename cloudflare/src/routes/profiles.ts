import { Hono } from 'hono';

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
