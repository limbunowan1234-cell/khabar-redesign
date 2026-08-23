import { Hono } from 'hono';
import { verifyUser } from '../lib/auth';

type Bindings = { DB: D1Database };

export const notifications = new Hono<{ Bindings: Bindings }>();

function toNotificationJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    articleId: row.article_id,
    articleSlug: row.article_slug,
    fromUserName: row.from_user_name,
    read: !!row.read,
    createdAt: row.created_at,
  };
}

// GET /notifications?userId=X&unreadOnly=1&limit=N -- a user's own
// notifications, private data, so the caller must present a verified JWT
// for the exact userId requested (same boundary as GET
// /articles?status=all). Read-only: marking read/unread, and creating a
// notification in the first place, both still write to Appwrite --
// app/api/send-notification/route.ts is a server-side admin-key route,
// same shape as the routes excluded in Weeks 15/16, and markRead/
// markAllRead are simple per-user writes that can follow in a later pass.
notifications.get('/', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'userId is required' }, 400);

  const user = await verifyUser(c.req.raw);
  if (!user || user.$id !== userId) return c.json({ error: 'Unauthorized' }, 401);

  const unreadOnly = c.req.query('unreadOnly') === '1';
  const limit = Math.min(parseInt(c.req.query('limit') || '15', 10) || 15, 100);

  const where = unreadOnly ? 'user_id = ? AND read = 0' : 'user_id = ?';
  const sql = `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(userId, limit).all();
  const docs = (results || []).map(toNotificationJson);

  const countRow = await c.env.DB
    .prepare(`SELECT COUNT(*) as total FROM notifications WHERE ${where}`)
    .bind(userId)
    .first();

  return c.json({ documents: docs, total: (countRow as any)?.total ?? 0 });
});
