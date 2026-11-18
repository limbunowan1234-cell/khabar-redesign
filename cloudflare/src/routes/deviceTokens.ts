import { Hono } from 'hono';
import { fcmConfigured, fcmProblem, subscribeToTopic, sendPush, type FcmEnv } from '../lib/fcm';

type Bindings = { DB: D1Database } & FcmEnv;

export const deviceTokens = new Hono<{ Bindings: Bindings }>();

export const BREAKING_TOPIC = 'breaking';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function validToken(t: unknown): t is string {
  return typeof t === 'string' && t.length >= 20 && t.length <= 4096 && /^[\w:\-.]+$/.test(t);
}

// POST /device-tokens  { token, platform?, appVersion? } -- public. The
// Android app (1.2.0+) calls this on every launch with its native FCM
// token, logged in or not. Upserts the row and, the first time, subscribes
// the token to the "breaking" topic. No user id is stored: breaking news
// goes to every reader, so there is nothing per-user to link.
deviceTokens.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!validToken(body?.token)) return c.json({ error: 'token is required' }, 400);
  const platform = body.platform === 'ios' ? 'ios' : 'android';
  const appVersion = typeof body.appVersion === 'string' ? body.appVersion.slice(0, 20) : null;

  await c.env.DB
    .prepare(
      `INSERT INTO device_tokens (token, platform, app_version) VALUES (?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET last_seen = datetime('now'), app_version = excluded.app_version`
    )
    .bind(body.token, platform, appVersion)
    .run();

  const row = await c.env.DB.prepare('SELECT topic_ok FROM device_tokens WHERE token = ?').bind(body.token).first<{ topic_ok: number }>();
  if (row?.topic_ok) return c.json({ ok: true, subscribed: true });

  if (!fcmConfigured(c.env)) return c.json({ ok: true, subscribed: false });
  const err = await subscribeToTopic(c.env, body.token, BREAKING_TOPIC).catch((e) => String(e));
  if (err) {
    console.error('topic subscribe failed:', err);
    return c.json({ ok: true, subscribed: false });
  }
  await c.env.DB.prepare('UPDATE device_tokens SET topic_ok = 1 WHERE token = ?').bind(body.token).run();
  return c.json({ ok: true, subscribed: true });
});

// POST /device-tokens/test  { token } -- public, but only ever sends one
// fixed message to the one token the caller supplied (i.e. to themselves).
// Used to check a phone end to end without broadcasting to everyone. Its
// tap opens the latest breaking story, so deep-linking is tested too.
deviceTokens.post('/test', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!validToken(body?.token)) return c.json({ error: 'token is required' }, 400);
  const problem = fcmProblem(c.env);
  if (problem) return c.json({ error: problem }, 503);
  const a = await c.env.DB
    .prepare("SELECT id, slug FROM articles WHERE status = 'published' AND is_breaking = 1 ORDER BY published_at DESC LIMIT 1")
    .first<{ id: string; slug: string | null }>();
  try {
    const name = await sendPush(c.env, { token: body.token }, {
      title: 'खबर दार्जिलिंग',
      body: 'Notifications are on. You will get breaking news from the hills here.',
      data: a ? { articleId: a.id, slug: a.slug || a.id } : {},
    });
    return c.json({ ok: true, name });
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

// Announces an article to every subscribed phone, once. Called (via
// waitUntil) from routes/articles.ts whenever a write leaves an article
// published + breaking. The INSERT OR IGNORE into breaking_pushes is the
// "once": a second toggle, an edit, or a retry finds the row and stops.
export async function pushBreakingIfNew(env: Bindings, articleId: string): Promise<void> {
  if (!fcmConfigured(env)) return;
  const a = await env.DB
    .prepare('SELECT id, slug, title, status, is_breaking, image_file_id FROM articles WHERE id = ?')
    .bind(articleId)
    .first<{ id: string; slug: string | null; title: string; status: string; is_breaking: number; image_file_id: string | null }>();
  if (!a || !a.is_breaking || a.status !== 'published' || !a.title) return;

  const claim = await env.DB.prepare('INSERT OR IGNORE INTO breaking_pushes (article_id) VALUES (?)').bind(a.id).run();
  if (!claim.meta.changes) return;

  try {
    const name = await sendPush(env, { topic: BREAKING_TOPIC }, {
      title: 'ब्रेकिङ · Breaking news',
      body: a.title,
      imageUrl: a.image_file_id ? WORKER_URL + '/cdn/articles/' + a.image_file_id : null,
      data: { articleId: a.id, slug: a.slug || a.id },
    });
    await env.DB.prepare('UPDATE breaking_pushes SET message_id = ? WHERE article_id = ?').bind(name, a.id).run();
  } catch (e) {
    // Release the claim so the next write to this article can try again.
    console.error('breaking push failed:', e);
    await env.DB.prepare('DELETE FROM breaking_pushes WHERE article_id = ?').bind(a.id).run();
  }
}
