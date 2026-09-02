import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';

type Bindings = { DB: D1Database; SERVICE_SECRET: string };

export const ads = new Hono<{ Bindings: Bindings }>();

// POST /ads/track  { campaignId, placementId, eventType, deviceType?,
// visitorId?, pageUrl? } -- public, matches the same trust level as
// analytics_events (Week 20): a burst of fake events is low-stakes noise,
// not a security hole, and requiring auth here would exclude the anonymous
// readers who are most of the ad audience in the first place. Only
// records against a campaign that actually exists and is active -- a
// disabled/removed campaign's stray tracking calls (e.g. a cached page
// still holding an old AdSlot) are silently dropped rather than piling
// up events for a dead campaign.
ads.post('/track', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body?.campaignId || !body?.placementId || !body?.eventType) {
    return c.json({ error: 'campaignId, placementId, and eventType are required' }, 400);
  }
  if (!['impression', 'click'].includes(body.eventType)) {
    return c.json({ error: 'Invalid eventType' }, 400);
  }

  const campaign = await c.env.DB.prepare('SELECT active FROM ad_campaigns WHERE id = ?').bind(body.campaignId).first();
  if (!campaign || !(campaign as any).active) {
    return c.json({ success: false, reason: 'Campaign not active' }, 200);
  }

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare('INSERT INTO ad_events (id, campaign_id, placement_id, event_type, device_type, visitor_id, page_url) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, body.campaignId, body.placementId, body.eventType, body.deviceType || null, body.visitorId || null, body.pageUrl || null)
    .run();

  return c.json({ success: true });
});

// GET /ads/analytics?campaignId=X&since=ISO -- admin-only (real JWT, not
// service-secret -- this exposes advertiser billing data, so it's gated
// the same way app/admin pages check identity: verifyUser + isAdmin
// against the caller's own Appwrite session, not a shared secret only
// the Next.js server holds).
ads.get('/analytics', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!isAdmin(user)) return c.json({ error: 'Admin access required' }, 403);

  const campaignId = c.req.query('campaignId');
  if (!campaignId) return c.json({ error: 'campaignId is required' }, 400);
  const since = c.req.query('since') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { results } = await c.env.DB
    .prepare('SELECT placement_id, event_type, device_type, created_at FROM ad_events WHERE campaign_id = ? AND created_at >= ?')
    .bind(campaignId, since)
    .all();

  const byPlacement: Record<string, { impressions: number; clicks: number }> = {};
  for (const row of (results || []) as any[]) {
    const p = row.placement_id;
    if (!byPlacement[p]) byPlacement[p] = { impressions: 0, clicks: 0 };
    if (row.event_type === 'impression') byPlacement[p].impressions += 1;
    else if (row.event_type === 'click') byPlacement[p].clicks += 1;
  }

  const totals = Object.values(byPlacement).reduce(
    (acc, p) => ({ impressions: acc.impressions + p.impressions, clicks: acc.clicks + p.clicks }),
    { impressions: 0, clicks: 0 }
  );

  return c.json({
    campaignId,
    since,
    totals: { ...totals, ctr: totals.impressions > 0 ? Math.round((totals.clicks / totals.impressions) * 1000) / 10 : 0 },
    byPlacement,
  });
});

// GET /ads/campaign/:id -- public, just the active flag + dates (no
// billing data) -- lets AdSlot.tsx confirm server-side whether a
// campaign is actually live without needing admin auth, as a second
// check alongside the local config's own `active` flag.
ads.get('/campaign/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT id, active, start_date, end_date FROM ad_campaigns WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ active: false });
  return c.json({ active: !!(row as any).active, startDate: (row as any).start_date, endDate: (row as any).end_date });
});
