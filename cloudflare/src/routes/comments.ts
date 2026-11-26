import { Hono } from 'hono';
import { verifyUser, isAdmin, isSuspended } from '../lib/auth';
import { HIDE_AFTER_REPORTS } from './reports';
import { logModeration } from '../lib/moderation';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string; };

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
    avatarUrl: row.profile_avatar || row.avatar_url,
    handle: row.profile_handle || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
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

  // Newest-first, matching every existing caller's orderDesc($createdAt).
  // Comments reported by HIDE_AFTER_REPORTS+ different people stay hidden
  // until an admin reviews them (routes/reports.ts).
  where.push(`id NOT IN (SELECT target_id FROM reports WHERE target_type = 'comment' AND status = 'open'
                         GROUP BY target_id HAVING COUNT(*) >= ${HIDE_AFTER_REPORTS})`);
  // Optional paging for the app: limit=N and before=<createdAt>. Without
  // them the website's existing "everything at once" behaviour is unchanged.
  const limit = q.limit ? Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100) : 5000;
  if (q.before) { where.push('created_at < ?'); params.push(q.before); }
  const sql = `SELECT comments.*,
      (SELECT p.avatar_url FROM profiles p WHERE p.user_id = comments.user_id) AS profile_avatar,
      (SELECT p.handle FROM profiles p WHERE p.user_id = comments.user_id) AS profile_handle
    FROM comments WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ${limit}`;
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  const docs = (results || []).map(toCommentJson);
  return c.json({ documents: docs, total: docs.length });
});

// --- Shadow-write only (see cloudflare/README.md) ---
// Appwrite stays authoritative. The JWT must match userId for creates.

// POST /comments  { id, articleId, parentCommentId?, userId, authorName, commentText, avatarUrl? }
// `id` is the real Appwrite document $id, passed through by the caller
// (not generated here) -- comments/replies get deleted by that id later,
// on both sides, so the two systems need to agree on it from the start.
comments.post('/', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  const body = await c.req.json().catch(() => null);
  if (!body?.id || !body?.articleId || !body?.userId || !body?.commentText) {
    return c.json({ error: 'id, articleId, userId, and commentText are required' }, 400);
  }
  if (!user || user.$id !== body.userId) return c.json({ error: 'Unauthorized' }, 401);
  if (!isAdmin(user) && (await isSuspended(c.env.DB, user.$id))) {
    return c.json({ error: 'Your account can no longer comment. Contact nowanad@gmail.com.' }, 403);
  }

  await c.env.DB
    .prepare('INSERT INTO comments (id, article_id, parent_comment_id, user_id, author_name, comment_text, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING')
    .bind(body.id, body.articleId, body.parentCommentId || null, body.userId, body.authorName || null, body.commentText, body.avatarUrl || null)
    .run();
  return c.json({ ok: true });
});

// PATCH /comments/:id  { commentText } -- edit your own comment.
comments.patch('/:id', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  const text = typeof body?.commentText === 'string' ? body.commentText.trim() : '';
  if (!text) return c.json({ error: 'commentText is required' }, 400);
  if (text.length > 2000) return c.json({ error: 'Comments can be up to 2000 characters.' }, 400);
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT user_id FROM comments WHERE id = ?').bind(id).first<{ user_id: string }>();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.user_id !== user.$id) return c.json({ error: 'Unauthorized' }, 401);
  if (await isSuspended(c.env.DB, user.$id)) {
    return c.json({ error: 'Your account can no longer comment. Contact nowanad@gmail.com.' }, 403);
  }
  await c.env.DB.prepare("UPDATE comments SET comment_text = ?, updated_at = datetime('now') WHERE id = ?").bind(text, id).run();
  return c.json({ ok: true });
});

// DELETE /comments/:id -- own comment, or an admin deleting anyone's
// (matches the canDelete = user.$id === c.userId || isAdmin check every
// client component already applies before even showing the button).
comments.delete('/:id', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT user_id FROM comments WHERE id = ?').bind(id).first();
  if (!row) return c.json({ ok: true }); // already gone -- deleting is idempotent
  if ((row as any).user_id !== user.$id && !isAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);
  if ((row as any).user_id !== user.$id) await logModeration(c.env.DB, user, 'delete_comment', 'comment', id);

  await c.env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});
