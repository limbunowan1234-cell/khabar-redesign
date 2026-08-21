import { Hono } from 'hono';

type Bindings = { DB: D1Database };

export const likes = new Hono<{ Bindings: Bindings }>();

function toLikeJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    articleId: row.article_id,
    commentId: row.comment_id,
    userId: row.user_id,
  };
}

// GET /likes?articleId=X        -> article-level likes (excludes comment likes)
// GET /likes?commentId=X        -> likes on one comment
// GET /likes?articleIds=a,b,c   -> article-level likes across several articles (author scoring)
// GET /likes?userId=X           -> every like a user has cast
// GET /likes?articleId=X&userId=Y -> check whether Y liked article X (toggle-state check)
likes.get('/', async (c) => {
  const q = c.req.query();
  const where: string[] = [];
  const params: unknown[] = [];

  if (q.articleIds) {
    const ids = q.articleIds.split(',').filter(Boolean);
    if (ids.length === 0) return c.json({ documents: [], total: 0 });
    where.push(`article_id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
    where.push('comment_id IS NULL');
  } else if (q.commentId) {
    where.push('comment_id = ?');
    params.push(q.commentId);
  } else if (q.articleId) {
    where.push('article_id = ?');
    params.push(q.articleId);
    where.push('comment_id IS NULL');
  } else if (q.userId) {
    where.push('user_id = ?');
    params.push(q.userId);
  } else {
    return c.json({ error: 'articleId, commentId, articleIds, or userId is required' }, 400);
  }

  if (q.userId && (q.articleId || q.commentId)) {
    where.push('user_id = ?');
    params.push(q.userId);
  }

  const sql = `SELECT * FROM likes WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 5000`;
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  const docs = (results || []).map(toLikeJson);
  return c.json({ documents: docs, total: docs.length });
});
