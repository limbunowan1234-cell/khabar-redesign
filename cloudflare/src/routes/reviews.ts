import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';
import { verifyPlayer } from '../lib/player';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string };

export const reviews = new Hono<{ Bindings: Bindings }>();

// Star ratings and comments on /apps listings. Any player (see
// routes/players.ts) can leave one review per app and change it later; a
// review shows straight away, and a site admin can delete any review.

const MAX_COMMENT = 1000;

function toJson(row: any) {
  return {
    $id: row.id,
    appId: row.app_id,
    playerId: row.player_id,
    gameName: row.game_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function summary(db: D1Database, appId: string) {
  const s = await db
    .prepare('SELECT COUNT(*) AS count, AVG(rating) AS average FROM app_reviews WHERE app_id = ?')
    .bind(appId)
    .first<{ count: number; average: number | null }>();
  return { count: s?.count || 0, average: s?.average ? Math.round(s.average * 10) / 10 : null };
}

// GET /app-reviews?appId=X -> { count, average, reviews: [...] } newest first
reviews.get('/', async (c) => {
  const appId = c.req.query('appId');
  if (!appId) return c.json({ error: 'appId is required' }, 400);
  const { results } = await c.env.DB
    .prepare(`SELECT r.*, p.game_name FROM app_reviews r JOIN players p ON p.id = r.player_id
              WHERE r.app_id = ? ORDER BY r.updated_at DESC LIMIT 200`)
    .bind(appId)
    .all();
  return c.json({ ...(await summary(c.env.DB, appId)), reviews: (results || []).map(toJson) });
});

// PUT /app-reviews { appId, rating: 1-5, comment? } -> creates or updates
// the logged-in player's review of that app.
reviews.put('/', async (c) => {
  const player = await verifyPlayer(c.req.raw, c.env);
  if (!player) return c.json({ error: 'Log in to rate this app.' }, 401);
  const body = await c.req.json().catch(() => null);
  const rating = Number(body?.rating);
  if (typeof body?.appId !== 'string' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return c.json({ error: 'Pick a rating from 1 to 5 stars.' }, 400);
  }
  const comment = typeof body.comment === 'string' ? body.comment.replace(/\r\n/g, '\n').trim() : '';
  if (comment.length > MAX_COMMENT) return c.json({ error: `Comments can be up to ${MAX_COMMENT} characters.` }, 400);

  const app = await c.env.DB
    .prepare("SELECT id FROM downloads WHERE id = ? AND active = 1 AND status = 'approved'")
    .bind(body.appId)
    .first();
  if (!app) return c.json({ error: 'App not found' }, 404);

  await c.env.DB
    .prepare(`INSERT INTO app_reviews (id, app_id, player_id, rating, comment) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (app_id, player_id) DO UPDATE SET
                rating = excluded.rating, comment = excluded.comment, updated_at = datetime('now')`)
    .bind(crypto.randomUUID(), body.appId, player.id, rating, comment || null)
    .run();

  const row = await c.env.DB
    .prepare('SELECT r.*, p.game_name FROM app_reviews r JOIN players p ON p.id = r.player_id WHERE r.app_id = ? AND r.player_id = ?')
    .bind(body.appId, player.id)
    .first();
  return c.json({ review: toJson(row), ...(await summary(c.env.DB, body.appId)) });
});

// DELETE /app-reviews/:id -- the review's own author (player token) or a
// site admin (site login token).
reviews.delete('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT id, player_id FROM app_reviews WHERE id = ?').bind(c.req.param('id')).first<any>();
  if (!row) return c.json({ error: 'Review not found' }, 404);

  const [player, user] = await Promise.all([verifyPlayer(c.req.raw, c.env), verifyUser(c.req.raw, c.env)]);
  if (player?.id !== row.player_id && !isAdmin(user)) return c.json({ error: 'Not allowed' }, 403);

  await c.env.DB.prepare('DELETE FROM app_reviews WHERE id = ?').bind(row.id).run();
  return c.json({ ok: true });
});
