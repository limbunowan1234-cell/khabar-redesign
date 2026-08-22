import { Hono } from 'hono';
import { verifyUser } from '../lib/auth';

type Bindings = { DB: D1Database };

export const follows = new Hono<{ Bindings: Bindings }>();

function toFollowJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    followerId: row.follower_id,
    followerName: row.follower_name,
    followingId: row.following_id,
    followingName: row.following_name,
    createdAt: row.created_at,
  };
}

// GET /follows?followingId=X                -> X's followers
// GET /follows?followerId=X                  -> who X follows
// GET /follows?followerId=X&followingId=Y    -> does X follow Y (empty documents[] if not)
follows.get('/', async (c) => {
  const q = c.req.query();
  const where: string[] = [];
  const params: unknown[] = [];

  if (q.followerId) { where.push('follower_id = ?'); params.push(q.followerId); }
  if (q.followingId) { where.push('following_id = ?'); params.push(q.followingId); }
  if (where.length === 0) return c.json({ error: 'followerId and/or followingId is required' }, 400);

  const sql = `SELECT * FROM follows WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 5000`;
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  const docs = (results || []).map(toFollowJson);
  return c.json({ documents: docs, total: docs.length });
});

// --- Shadow-write only (see cloudflare/README.md) ---
// Appwrite stays authoritative. The JWT must match followerId -- the
// person doing the following is the one taking the action, not the
// person being followed.

// POST /follows  { followerId, followerName, followingId, followingName }
follows.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const body = await c.req.json().catch(() => null);
  if (!body?.followerId || !body?.followingId) return c.json({ error: 'followerId and followingId are required' }, 400);
  if (!user || user.$id !== body.followerId) return c.json({ error: 'Unauthorized' }, 401);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare('INSERT INTO follows (id, follower_id, follower_name, following_id, following_name) VALUES (?, ?, ?, ?, ?) ON CONFLICT (follower_id, following_id) DO NOTHING')
    .bind(id, body.followerId, body.followerName || null, body.followingId, body.followingName || null)
    .run();
  return c.json({ ok: true });
});

// DELETE /follows?followerId=X&followingId=Y
follows.delete('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const q = c.req.query();
  if (!q.followerId || !q.followingId) return c.json({ error: 'followerId and followingId are required' }, 400);
  if (!user || user.$id !== q.followerId) return c.json({ error: 'Unauthorized' }, 401);

  await c.env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').bind(q.followerId, q.followingId).run();
  return c.json({ ok: true });
});
