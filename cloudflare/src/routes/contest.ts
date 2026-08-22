import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';

type Bindings = { DB: D1Database };

export const contest = new Hono<{ Bindings: Bindings }>();

// GET /contest/settings -> the single contest_settings row (certificatesLive,
// pinnedCommentId).
contest.get('/settings', async (c) => {
  const row = await c.env.DB.prepare('SELECT certificates_live, pinned_comment_id FROM contest_settings WHERE id = 1').first();
  return c.json({
    certificatesLive: !!(row as any)?.certificates_live,
    pinnedCommentId: (row as any)?.pinned_comment_id || null,
  });
});

// --- Shadow-write only (see cloudflare/README.md) ---
// Appwrite stays authoritative. Admin-gated, same as an admin deleting
// someone else's comment -- reuses the exact per-admin JWT the caller
// already verified against Appwrite before writing there (the API key
// used for the Appwrite write itself is a separate, unrelated thing:
// that's only there to sidestep contest_settings/main's empty
// $permissions, not to authenticate the admin).
//
// POST /contest/settings  { certificatesLive?, pinnedCommentId? }
// Only the fields present in the body are updated.
contest.post('/settings', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!isAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => null);
  if (!body || (body.certificatesLive === undefined && body.pinnedCommentId === undefined)) {
    return c.json({ error: 'certificatesLive and/or pinnedCommentId required' }, 400);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.certificatesLive !== undefined) { sets.push('certificates_live = ?'); params.push(body.certificatesLive ? 1 : 0); }
  if (body.pinnedCommentId !== undefined) { sets.push('pinned_comment_id = ?'); params.push(body.pinnedCommentId || null); }

  await c.env.DB.prepare(`UPDATE contest_settings SET ${sets.join(', ')} WHERE id = 1`).bind(...params).run();
  return c.json({ ok: true });
});
