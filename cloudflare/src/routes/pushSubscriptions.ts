import { Hono } from 'hono';
import { verifyUser, verifyService } from '../lib/auth';

type Bindings = { DB: D1Database; SERVICE_SECRET: string };

export const pushSubscriptions = new Hono<{ Bindings: Bindings }>();

function toSubJson(row: any) {
  return { $id: row.id, userId: row.user_id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth };
}

// POST /push-subscriptions  { userId, endpoint, p256dh, auth } -- own-user
// only. Called from components/NotificationBell.tsx's enablePush(). No
// uniqueness enforced on endpoint (matches the Appwrite-era behavior this
// replaces) -- a re-registered device just adds a harmless duplicate row.
pushSubscriptions.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const body = await c.req.json().catch(() => null);
  if (!body?.userId || !body?.endpoint || !body?.p256dh || !body?.auth) {
    return c.json({ error: 'userId, endpoint, p256dh, and auth are required' }, 400);
  }
  if (!user || user.$id !== body.userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)')
    .bind(id, body.userId, body.endpoint, body.p256dh, body.auth)
    .run();
  return c.json({ ok: true });
});

// GET /push-subscriptions?userId=X -- service-only. app/api/send-notification
// looks up an arbitrary recipient's subscriptions on the system's behalf to
// push to them, not the caller's own -- no end-user JWT applies here (see
// verifyService's comment in ../lib/auth.ts).
pushSubscriptions.get('/', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'userId is required' }, 400);

  const { results } = await c.env.DB.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').bind(userId).all();
  return c.json({ documents: (results || []).map(toSubJson) });
});

// DELETE /push-subscriptions/:id -- service-only. send-notification calls
// this when webpush reports a subscription is gone (410/404).
pushSubscriptions.delete('/:id', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
