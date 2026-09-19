import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string };

export const donations = new Hono<{ Bindings: Bindings }>();

// POST /donations  { name, email?, amount?, message? }
// Support-message log for the /raunak-fundraiser page (and any future
// fundraiser reusing this table). This never touches real money -- a
// donor pays by scanning the UPI QR code shown on the page directly to
// the family's own UPI ID; this just records who said they gave, and
// their message, as a self-reported pledge, not a verified transaction.
// Public and unauthenticated on purpose, same trust level as
// ads.post('/track') -- a fake entry here is low-stakes noise, not a
// security hole, and requiring login would exclude the exact anonymous
// well-wishers this page is for.
donations.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = body?.name?.trim();
  const email = body?.email?.trim() || null;
  const message = body?.message?.trim() || null;
  const amountRaw = body?.amount;
  const amount = amountRaw === '' || amountRaw === null || amountRaw === undefined ? null : Number(amountRaw);

  if (!name) return c.json({ error: 'name is required' }, 400);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return c.json({ error: 'amount must be a positive number' }, 400);
  }
  if (name.length > 200) return c.json({ error: 'name is too long' }, 400);
  if (message && message.length > 2000) return c.json({ error: 'message is too long' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare('INSERT INTO donations (id, name, email, amount, message) VALUES (?, ?, ?, ?, ?)')
    .bind(id, name, email, amount, message)
    .run();

  return c.json({ ok: true });
});

// GET /donations -- admin-only. Lists every pledge/message (name, email,
// amount, message, timestamp) -- gated because it's a list of real
// people's names/emails, same boundary as every other admin listing in
// this app (verifyUser + isAdmin).
donations.get('/', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!isAdmin(user)) return c.json({ error: 'Admin access required' }, 403);

  const { results } = await c.env.DB
    .prepare('SELECT id, name, email, amount, message, timestamp FROM donations ORDER BY timestamp DESC LIMIT 1000')
    .all();

  const total = (results || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
  return c.json({ documents: results || [], total: (results || []).length, totalAmount: total });
});
