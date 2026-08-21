import { Hono } from 'hono';

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
