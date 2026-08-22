import { Hono } from 'hono';

type Bindings = { DB: D1Database };

export const certificates = new Hono<{ Bindings: Bindings }>();

// GET /certificates?userId=X -> that user's certificate_state row, or
// downloadCount 0 if they've never downloaded one. Read-only for now --
// the download itself (app/profile/page.tsx) still increments the count
// on Appwrite only, so this can lag by however many downloads happened
// since the last export. Low-stakes: worst case someone re-downloads
// their own certificate PNG past the 3-download cap, not a security or
// data-integrity issue.
certificates.get('/', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'userId is required' }, 400);

  const row = await c.env.DB.prepare('SELECT download_count, rank FROM certificate_state WHERE user_id = ?').bind(userId).first();
  return c.json({
    downloadCount: (row as any)?.download_count ?? 0,
    rank: (row as any)?.rank ?? null,
  });
});
