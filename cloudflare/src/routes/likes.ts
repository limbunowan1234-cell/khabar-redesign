import { Hono } from 'hono';
import { verifyUser } from '../lib/auth';

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

// --- Shadow-write only (see cloudflare/README.md) ---
// Appwrite is still the source of truth for every real user-facing like/
// unlike. These exist so the client can mirror that same outcome into D1
// alongside it, so the two can be diffed before anything actually reads
// from or depends on D1 for likes. Both require a JWT for the exact
// userId being written -- nobody can create or remove a like on anyone
// else's behalf, same boundary as the status=all read check.

// POST /likes  { articleId, commentId?, userId }
likes.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const body = await c.req.json().catch(() => null);
  if (!body?.articleId || !body?.userId) return c.json({ error: 'articleId and userId are required' }, 400);
  if (!user || user.$id !== body.userId) return c.json({ error: 'Unauthorized' }, 401);

  // Two different partial unique indexes back this (see db/schema.sql --
  // the table-level UNIQUE(article_id, comment_id, user_id) alone doesn't
  // stop duplicates because SQL treats every NULL comment_id as distinct).
  // ON CONFLICT has to name the matching one exactly, so this branches.
  const id = crypto.randomUUID();
  if (body.commentId) {
    await c.env.DB
      .prepare('INSERT INTO likes (id, article_id, comment_id, user_id) VALUES (?, ?, ?, ?) ON CONFLICT (comment_id, user_id) WHERE comment_id IS NOT NULL DO NOTHING')
      .bind(id, body.articleId, body.commentId, body.userId)
      .run();
  } else {
    await c.env.DB
      .prepare('INSERT INTO likes (id, article_id, comment_id, user_id) VALUES (?, ?, NULL, ?) ON CONFLICT (article_id, user_id) WHERE comment_id IS NULL DO NOTHING')
      .bind(id, body.articleId, body.userId)
      .run();
  }
  return c.json({ ok: true });
});

// DELETE /likes?articleId=X&userId=Y[&commentId=Z]
likes.delete('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const q = c.req.query();
  if (!q.articleId || !q.userId) return c.json({ error: 'articleId and userId are required' }, 400);
  if (!user || user.$id !== q.userId) return c.json({ error: 'Unauthorized' }, 401);

  if (q.commentId) {
    await c.env.DB.prepare('DELETE FROM likes WHERE article_id = ? AND comment_id = ? AND user_id = ?').bind(q.articleId, q.commentId, q.userId).run();
  } else {
    await c.env.DB.prepare('DELETE FROM likes WHERE article_id = ? AND comment_id IS NULL AND user_id = ?').bind(q.articleId, q.userId).run();
  }
  return c.json({ ok: true });
});
