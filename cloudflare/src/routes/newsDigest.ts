import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';

type Bindings = { DB: D1Database };

export const newsDigest = new Hono<{ Bindings: Bindings }>();

// Single-row admin cache (app/admin/news-digest/page.tsx), same shape as
// contest_settings -- admin-only, no public consumer. Both GET and POST
// are admin-gated since nothing here was ever meant to be public.
//
// Not covered: the Vercel-cron-triggered refresh path
// (NEWS_DIGEST_CRON_SECRET, see app/api/admin/news-digest/route.ts) has
// no per-admin JWT to reuse, and that secret isn't available in this
// session to provision a matching Worker check -- same excluded shape as
// Week 20's analytics_events retention cron. The admin-JWT path (manual
// refresh/save from the admin UI) covers the interactive usage this
// migrates.

newsDigest.get('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);

  const row = await c.env.DB.prepare('SELECT sections_json, last_verified, updated_at FROM news_digest WHERE id = 1').first();
  if (!row) return c.json({ digest: null });
  return c.json({
    digest: {
      sectionsJson: (row as any).sections_json,
      lastVerified: (row as any).last_verified,
      updatedAt: (row as any).updated_at,
    },
  });
});

newsDigest.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => null);
  if (!body?.sectionsJson) return c.json({ error: 'sectionsJson is required' }, 400);

  await c.env.DB
    .prepare('UPDATE news_digest SET sections_json = ?, last_verified = ?, updated_at = ? WHERE id = 1')
    .bind(body.sectionsJson, body.lastVerified || null, body.updatedAt || new Date().toISOString())
    .run();
  return c.json({ ok: true });
});
