import { Hono } from 'hono';
import { verifyUser } from '../lib/auth';

type Bindings = { DB: D1Database };

export const certificates = new Hono<{ Bindings: Bindings }>();

// GET /certificates?userId=X -> that user's certificate_state row, or
// downloadCount 0 if they've never downloaded one.
certificates.get('/', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'userId is required' }, 400);

  const row = await c.env.DB.prepare('SELECT download_count, rank FROM certificate_state WHERE user_id = ?').bind(userId).first();
  return c.json({
    downloadCount: (row as any)?.download_count ?? 0,
    rank: (row as any)?.rank ?? null,
  });
});

// Week 31 of the Cloudflare migration (see cloudflare/README.md): writes
// to D1 directly now -- Appwrite's certificate_state collection is
// frozen as of this cutover. Unlike the Appwrite version (which needed
// a docId lookup to decide PATCH vs POST, the same get-or-create race
// that produced Week 17's duplicate-row bug), this is a single upsert
// keyed on the real UNIQUE(user_id) constraint -- no docId, no race.
//
// POST /certificates  { userId, downloadCount, rank }
certificates.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const body = await c.req.json().catch(() => null);
  if (!body?.userId || body?.downloadCount === undefined) {
    return c.json({ error: 'userId and downloadCount are required' }, 400);
  }
  if (!user || user.$id !== body.userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO certificate_state (id, user_id, download_count, rank) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET download_count = excluded.download_count, rank = excluded.rank`
    )
    .bind(id, body.userId, body.downloadCount, body.rank || null)
    .run();
  return c.json({ ok: true });
});
