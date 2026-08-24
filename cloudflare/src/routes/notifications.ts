import { Hono } from 'hono';
import { verifyUser, verifyService } from '../lib/auth';

type Bindings = { DB: D1Database; SERVICE_SECRET: string };

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
// /articles?status=all).
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

// POST /notifications  { userId, type, message, articleId?, articleSlug?,
// fromUserName? } -- service-only. app/api/send-notification creates these
// on behalf of whichever *other* user triggered the notification (e.g. a
// comment reply), so the recipient never has a JWT to present here.
notifications.post('/', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body?.userId || !body?.message) return c.json({ error: 'userId and message are required' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO notifications (id, user_id, type, message, article_id, article_slug, from_user_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, body.userId, body.type || 'general', body.message, body.articleId || null, body.articleSlug || null, body.fromUserName || null)
    .run();
  return c.json({ ok: true, id });
});

// PATCH /notifications/:id  { read: true } -- own-user only, matches
// NotificationBell.tsx's markRead/markAllRead (one call per notification).
notifications.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await verifyUser(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const row = await c.env.DB.prepare('SELECT user_id FROM notifications WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if ((row as any).user_id !== user.$id) return c.json({ error: 'Unauthorized' }, 401);

  await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});
