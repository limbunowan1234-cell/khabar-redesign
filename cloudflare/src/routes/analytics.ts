import { Hono } from 'hono';

type Bindings = { DB: D1Database };

export const analytics = new Hono<{ Bindings: Bindings }>();

// POST /analytics/events -- public, unauthenticated, same trust model as
// PATCH /articles/:id/views: anonymous page-view telemetry, no user
// session involved (most readers aren't logged in). Week 32: this is
// the only write now -- app/api/analytics/track/route.ts no longer
// touches Appwrite at all. 30-day retention runs natively as a
// Cloudflare Cron Trigger (see the scheduled() handler in index.ts),
// not an HTTP route, so it needs no auth of its own.
analytics.post('/events', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.id || !body?.visitorId || !body?.eventType || !body?.timestamp) {
    return c.json({ error: 'id, visitorId, eventType, and timestamp are required' }, 400);
  }
  await c.env.DB
    .prepare('INSERT INTO analytics_events (id, visitor_id, user_id, event_type, article_id, user_country, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING')
    .bind(body.id, body.visitorId, body.userId || null, body.eventType, body.articleId || null, body.userCountry || null, body.timestamp)
    .run();
  return c.json({ ok: true });
});

// GET /analytics/events?since=<iso> -- not private (visitor ids, not
// account identities), and only ever called server-to-server from the
// already admin-gated app/api/admin/analytics/route.ts, same trust level
// as every other public GET on this Worker.
analytics.get('/events', async (c) => {
  const since = c.req.query('since');
  if (!since) return c.json({ error: 'since is required' }, 400);
  const { results } = await c.env.DB
    .prepare('SELECT visitor_id, user_id, event_type, article_id, user_country, timestamp FROM analytics_events WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT 50000')
    .bind(since)
    .all();
  const documents = (results || []).map((r: any) => ({
    visitorId: r.visitor_id,
    userId: r.user_id,
    eventType: r.event_type,
    articleId: r.article_id,
    userCountry: r.user_country,
    timestamp: r.timestamp,
  }));
  return c.json({ documents, total: documents.length });
});
