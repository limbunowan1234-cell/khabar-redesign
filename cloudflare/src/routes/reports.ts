import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';
import { logModeration } from '../lib/moderation';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string };

export const reports = new Hono<{ Bindings: Bindings }>();

const TARGETS = ['comment', 'article', 'user'];
const REASONS = ['spam', 'abuse', 'hate', 'sexual', 'violence', 'false', 'other'];

// Comments with this many open reports from different people drop out of
// GET /comments until an admin reviews them (see routes/comments.ts).
export const HIDE_AFTER_REPORTS = 3;

// POST /reports  { targetType, targetId, reason, details?, reporterKey? }
// Anyone can report, logged in or not: Play requires the report button to
// work for every reader. Logged-in reports are keyed by user id; the app
// sends a random per-install id (reporterKey) otherwise. One report per
// person per item: a repeat just returns ok.
reports.post('/', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  const body = await c.req.json().catch(() => null);
  const targetType = String(body?.targetType || '');
  const targetId = String(body?.targetId || '').slice(0, 200);
  const reason = String(body?.reason || '');
  if (!TARGETS.includes(targetType) || !targetId || !REASONS.includes(reason)) {
    return c.json({ error: 'targetType, targetId and a valid reason are required' }, 400);
  }
  const anonKey = typeof body?.reporterKey === 'string' && /^[\w-]{8,64}$/.test(body.reporterKey) ? body.reporterKey : null;
  const reporterKey = user ? user.$id : anonKey ? 'anon:' + anonKey : null;
  if (!reporterKey) return c.json({ error: 'reporterKey is required when not logged in' }, 400);
  const details = typeof body?.details === 'string' ? body.details.slice(0, 1000) : null;

  await c.env.DB
    .prepare(
      `INSERT INTO reports (id, target_type, target_id, reason, details, reporter_id, reporter_key)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (target_type, target_id, reporter_key) DO NOTHING`
    )
    .bind(crypto.randomUUID(), targetType, targetId, reason, details, user?.$id || null, reporterKey)
    .run();
  return c.json({ ok: true });
});

// GET /reports?status=open  -- admin only. Grouped per reported item, with
// a preview of the comment or article so it can be judged without a click.
reports.get('/', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);
  const status = c.req.query('status') || 'open';
  const { results } = await c.env.DB
    .prepare(
      `SELECT r.target_type, r.target_id, COUNT(*) AS count,
              GROUP_CONCAT(DISTINCT r.reason) AS reasons,
              MIN(r.created_at) AS first_at, MAX(r.created_at) AS last_at,
              cm.comment_text, cm.author_name AS comment_author, cm.user_id AS comment_user_id, cm.article_id AS comment_article_id,
              a.title AS article_title, a.slug AS article_slug, a.submitter_id AS article_submitter_id,
              a.submitter_name AS article_submitter_name, a.kind AS article_kind, a.status AS article_status,
              u.name AS user_name, u.labels AS user_labels
         FROM reports r
         LEFT JOIN comments cm ON r.target_type = 'comment' AND cm.id = r.target_id
         LEFT JOIN articles a ON r.target_type = 'article' AND a.id = r.target_id
         LEFT JOIN users u ON r.target_type = 'user' AND u.id = r.target_id
        WHERE r.status = ?
        GROUP BY r.target_type, r.target_id
        ORDER BY last_at DESC
        LIMIT 500`
    )
    .bind(status)
    .all();
  return c.json({ documents: results || [] });
});

// PATCH /reports  { targetType, targetId, status: 'actioned' | 'dismissed' }
// -- admin only. Closes every open report on that item at once.
reports.patch('/', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!TARGETS.includes(body?.targetType) || !body?.targetId || !['actioned', 'dismissed'].includes(body?.status)) {
    return c.json({ error: 'targetType, targetId and status (actioned|dismissed) are required' }, 400);
  }
  await c.env.DB
    .prepare(`UPDATE reports SET status = ?, reviewed_at = datetime('now') WHERE target_type = ? AND target_id = ? AND status = 'open'`)
    .bind(body.status, body.targetType, body.targetId)
    .run();
  await logModeration(c.env.DB, user!, body.status === 'dismissed' ? 'dismiss_report' : 'action_report', body.targetType, body.targetId, body.note || null);
  return c.json({ ok: true });
});
