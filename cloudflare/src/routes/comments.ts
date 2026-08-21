import { Hono } from 'hono';

type Bindings = { DB: D1Database };

export const comments = new Hono<{ Bindings: Bindings }>();

function toCommentJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    articleId: row.article_id,
    parentCommentId: row.parent_comment_id,
    userId: row.user_id,
    authorName: row.author_name,
    commentText: row.comment_text,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

// GET /comments?articleId=X       -> all comments on one article (or the
//                                     fixed contest-discussion pseudo-id)
// GET /comments?articleIds=a,b,c  -> comments across several articles (author scoring)
// GET /comments?userId=X          -> every comment a user has posted
comments.get('/', async (c) => {
  const q = c.req.query();
  const where: string[] = [];
  const params: unknown[] = [];

  if (q.articleIds) {
    const ids = q.articleIds.split(',').filter(Boolean);
    if (ids.length === 0) return c.json({ documents: [], total: 0 });
    where.push(`article_id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  } else if (q.articleId) {
    where.push('article_id = ?');
    params.push(q.articleId);
  } else if (q.userId) {
    where.push('user_id = ?');
    params.push(q.userId);
  } else {
    return c.json({ error: 'articleId, articleIds, or userId is required' }, 400);
  }

  const sql = `SELECT * FROM comments WHERE ${where.join(' AND ')} ORDER BY created_at ASC LIMIT 5000`;
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  const docs = (results || []).map(toCommentJson);
  return c.json({ documents: docs, total: docs.length });
});
