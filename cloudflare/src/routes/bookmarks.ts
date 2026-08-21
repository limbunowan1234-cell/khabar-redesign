import { Hono } from 'hono';

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
