import { Hono } from 'hono';

// Generic key/value counter table (D1's app_counters) -- currently just
// backs the APK download count. Was on Appwrite's Database REST API
// (lib/appwrite.ts's trackApkDownload(), a read-then-increment against a
// single document) until auth's departure took the rest of that API down
// with it too; this is the same counter, moved here. Public, best-effort,
// same trust level as analytics_events (a fake increment is low-stakes
// noise, not a security hole).
type Bindings = { DB: D1Database };
export const counters = new Hono<{ Bindings: Bindings }>();

// POST /counters/:key/increment
counters.post('/:key/increment', async (c) => {
  const key = c.req.param('key');
  await c.env.DB.prepare(
    "INSERT INTO app_counters (key, value) VALUES (?, 1) ON CONFLICT (key) DO UPDATE SET value = value + 1"
  ).bind(key).run();
  const row = await c.env.DB.prepare('SELECT value FROM app_counters WHERE key = ?').bind(key).first() as any;
  return c.json({ key, value: row?.value ?? 1 });
});
