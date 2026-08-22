import { Hono } from 'hono';
import { verifyUser } from '../lib/auth';

type Bindings = { DB: D1Database };

export const bookmarks = new Hono<{ Bindings: Bindings }>();

function toBookmarkJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.saved_at,
    userId: row.user_id,
    articleId: row.article_id,
    savedAt: row.saved_at,
  };
}

// GET /bookmarks?userId=X               -> everything X has bookmarked
// GET /bookmarks?userId=X&articleId=Y   -> does X have Y bookmarked (empty documents[] if not)
bookmarks.get('/', async (c) => {
  const q = c.req.query();
  if (!q.userId) return c.json({ error: 'userId is required' }, 400);

  const where = ['user_id = ?'];
  const params: unknown[] = [q.userId];
  if (q.articleId) { where.push('article_id = ?'); params.push(q.articleId); }

  const sql = `SELECT * FROM bookmarks WHERE ${where.join(' AND ')} ORDER BY saved_at DESC LIMIT 5000`;
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  const docs = (results || []).map(toBookmarkJson);
  return c.json({ documents: docs, total: docs.length });
});

// --- Shadow-write only (see cloudflare/README.md) ---
// Appwrite stays authoritative. Both require a JWT for the exact userId
// being written, same boundary as /likes.

// POST /bookmarks  { userId, articleId }
bookmarks.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const body = await c.req.json().catch(() => null);
  if (!body?.userId || !body?.articleId) return c.json({ error: 'userId and articleId are required' }, 400);
  if (!user || user.$id !== body.userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare('INSERT INTO bookmarks (id, user_id, article_id) VALUES (?, ?, ?) ON CONFLICT (user_id, article_id) DO NOTHING')
    .bind(id, body.userId, body.articleId)
    .run();
  return c.json({ ok: true });
});

// DELETE /bookmarks?userId=X&articleId=Y
bookmarks.delete('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const q = c.req.query();
  if (!q.userId || !q.articleId) return c.json({ error: 'userId and articleId are required' }, 400);
  if (!user || user.$id !== q.userId) return c.json({ error: 'Unauthorized' }, 401);

  await c.env.DB.prepare('DELETE FROM bookmarks WHERE user_id = ? AND article_id = ?').bind(q.userId, q.articleId).run();
  return c.json({ ok: true });
});
