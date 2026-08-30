import { Hono } from 'hono';
import { verifyService, verifyUser } from '../lib/auth';

type Bindings = { DB: D1Database; SERVICE_SECRET: string };

export const bhasaDiwas = new Hono<{ Bindings: Bindings }>();

// Mirrors lib/bhasaDiwas.ts's BHASA_DIWAS_CLOSE_DATE in the Next.js app --
// duplicated (not shared) since this Worker and the Next app are separate
// bundles. The Next.js UI already hides the submit form and disables
// voting past this date; this is the server-side backstop so a direct
// POST to this API can't bypass that once the contest is closed.
const BHASA_DIWAS_CLOSE_DATE = '2026-08-30T00:00:00+05:30';
function isBhasaDiwasClosed(): boolean {
  return new Date() >= new Date(BHASA_DIWAS_CLOSE_DATE);
}

// Winner categories/topN are fixed here rather than passed in the request --
// finalize-winners is a one-button admin action, not a general-purpose API,
// so there's nothing to parameterize from the caller's side.
const WINNER_CATEGORIES = ['poetry', 'essay'];
const WINNERS_PER_CATEGORY = 3;

function toSubmissionJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    title: row.title,
    category: row.category,
    description: row.description,
    imageFileId: row.image_file_id,
    submitterId: row.submitter_id,
    submitterName: row.submitter_name,
    votes: row.votes,
    isFeatured: !!row.is_featured,
    // Public field -- lets a submitter see they won without exposing
    // anyone's mailing address. Address fields only ever appear in
    // toWinnerAdminJson, admin-only.
    winnerRank: row.winner_rank ?? null,
    addressSubmitted: !!row.address_submitted_at,
  };
}

function toWinnerAdminJson(row: any) {
  return {
    ...toSubmissionJson(row),
    winnerFullName: row.winner_full_name,
    winnerAddress: row.winner_address,
    winnerPhone: row.winner_phone,
    addressSubmittedAt: row.address_submitted_at,
  };
}

// GET /bhasa-diwas/submissions?category=poetry&sort=votes&limit=5
// GET /bhasa-diwas/submissions/:id
const submissions = new Hono<{ Bindings: Bindings }>();

submissions.get('/', async (c) => {
  const q = c.req.query();
  const limit = Math.min(parseInt(q.limit || '100', 10) || 100, 200);
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.category && q.category !== 'all') { where.push('category = ?'); params.push(q.category); }
  // Used by the "did I win?" check on the submitter's own page -- lets the
  // client find its own submissions (and their winnerRank) without a
  // separate endpoint.
  if (q.submitterId) { where.push('submitter_id = ?'); params.push(q.submitterId); }

  const whereSql = where.length > 0 ? where.join(' AND ') : '1=1';
  const orderBy = q.sort === 'votes' ? 'votes DESC' : 'created_at DESC';
  const sql = `SELECT * FROM bhasa_diwas_submissions WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(...params, limit).all();
  const docs = (results || []).map(toSubmissionJson);

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM bhasa_diwas_submissions WHERE ${whereSql}`).bind(...params).first();
  return c.json({ documents: docs, total: (countRow as any)?.total ?? 0 });
});

submissions.get('/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM bhasa_diwas_submissions WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(toSubmissionJson(row));
});

// POST /bhasa-diwas/submissions  { id, title, category, description,
// imageFileId?, submitterId, submitterName } -- service-only. Called from
// app/api/bhasa-diwas/submit/route.ts, which (like every Next.js route
// here) trusts the submitterId/voterId it's given rather than verifying a
// per-user JWT -- same trust level the old Appwrite-API-key version had,
// just relocated to D1. Photo upload itself stays on Appwrite Storage
// (imageFileId is an Appwrite file id either way); see cloudflare/README.md.
submissions.post('/', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);
  if (isBhasaDiwasClosed()) return c.json({ error: 'Submissions are closed' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body?.id || !body?.title || !body?.category || !body?.submitterId) {
    return c.json({ error: 'id, title, category, and submitterId are required' }, 400);
  }
  if (!['poetry', 'essay', 'photo'].includes(body.category)) {
    return c.json({ error: 'Invalid category' }, 400);
  }

  await c.env.DB
    .prepare(
      `INSERT INTO bhasa_diwas_submissions (id, title, category, description, image_file_id, submitter_id, submitter_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(body.id, body.title, body.category, body.description || null, body.imageFileId || null, body.submitterId, body.submitterName || null)
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM bhasa_diwas_submissions WHERE id = ?').bind(body.id).first();
  return c.json({ success: true, submission: toSubmissionJson(row) });
});

// PATCH /bhasa-diwas/submissions/:id  { isFeatured } -- service-only.
// admin-feature/route.ts already verifies real admin identity itself
// (Appwrite cookie session) before calling this.
submissions.patch('/:id', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  if (typeof body?.isFeatured !== 'boolean') return c.json({ error: 'isFeatured (boolean) is required' }, 400);

  await c.env.DB.prepare('UPDATE bhasa_diwas_submissions SET is_featured = ? WHERE id = ?').bind(body.isFeatured ? 1 : 0, c.req.param('id')).run();
  return c.json({ success: true });
});

// DELETE /bhasa-diwas/submissions/:id -- service-only. admin-delete/route.ts
// already verifies real admin identity itself. Matches the old Appwrite
// behavior exactly: deletes only the submission row, not its votes.
submissions.delete('/:id', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);
  await c.env.DB.prepare('DELETE FROM bhasa_diwas_submissions WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// PATCH /bhasa-diwas/submissions/:id/winner-address  { fullName, address, phone }
// Real per-user auth (unlike the rest of this file's writes, which are
// service-only and trust the Next.js layer) -- this is called directly by
// the winner's own browser with their Appwrite JWT, the same pattern
// comments/likes/photography use. Only the submission's own submitter can
// set its address, and only once it's actually a winner (winner_rank set),
// so a random logged-in user can't plant their address on someone else's
// entry, and no one can submit an address before finalize-winners has run.
submissions.patch('/:id/winner-address', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json().catch(() => null);
  if (!body?.fullName || !body?.address || !body?.phone) {
    return c.json({ error: 'fullName, address, and phone are required' }, 400);
  }

  const row: any = await c.env.DB.prepare('SELECT submitter_id, winner_rank FROM bhasa_diwas_submissions WHERE id = ?').bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if (row.submitter_id !== user.$id) return c.json({ error: 'Not your submission' }, 403);
  if (row.winner_rank === null || row.winner_rank === undefined) return c.json({ error: 'This entry is not a winner' }, 403);

  await c.env.DB
    .prepare(`UPDATE bhasa_diwas_submissions
              SET winner_full_name = ?, winner_address = ?, winner_phone = ?, address_submitted_at = datetime('now')
              WHERE id = ?`)
    .bind(body.fullName, body.address, body.phone, c.req.param('id'))
    .run();

  return c.json({ success: true });
});

bhasaDiwas.route('/submissions', submissions);

// POST /bhasa-diwas/finalize-winners -- service-only (admin-gated by the
// Next.js proxy at app/api/bhasa-diwas/finalize-winners/route.ts, same
// pattern as admin-feature). Ranks the top 3 (by votes, ties broken by
// earlier submission) in poetry and essay, sets winner_rank on them, and
// clears winner_rank on anything no longer in the top 3 -- so it's safe to
// re-run if votes change before results are locked in, without leaving a
// stale winner flagged. Deliberately re-derives ranks from scratch every
// run rather than only ever adding winners.
bhasaDiwas.post('/finalize-winners', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);

  const winners: Record<string, any[]> = {};
  for (const category of WINNER_CATEGORIES) {
    // One prize per person per category -- a submitter with two entries
    // in the same category (e.g. two essays) shouldn't be able to take
    // two of the three winner slots. Fetch every entry ranked within the
    // category (votes DESC, created_at ASC as the tiebreak), then walk
    // that ranking and keep only the first (i.e. highest-ranked) entry
    // per submitter_id -- everyone's *best* entry competes, but only
    // once each, until WINNERS_PER_CATEGORY distinct people are picked.
    const { results: ranked } = await c.env.DB
      .prepare('SELECT id, submitter_id FROM bhasa_diwas_submissions WHERE category = ? ORDER BY votes DESC, created_at ASC')
      .bind(category)
      .all();
    const seenSubmitters = new Set<string>();
    const ids: string[] = [];
    for (const row of (ranked || []) as any[]) {
      if (seenSubmitters.has(row.submitter_id)) continue;
      seenSubmitters.add(row.submitter_id);
      ids.push(row.id);
      if (ids.length === WINNERS_PER_CATEGORY) break;
    }

    // Clear stale winner flags in this category first (anything not in the
    // fresh top-N), then stamp the current top-N with their rank.
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      await c.env.DB.prepare(`UPDATE bhasa_diwas_submissions SET winner_rank = NULL WHERE category = ? AND id NOT IN (${placeholders})`).bind(category, ...ids).run();
    } else {
      await c.env.DB.prepare('UPDATE bhasa_diwas_submissions SET winner_rank = NULL WHERE category = ?').bind(category).run();
    }
    for (let i = 0; i < ids.length; i++) {
      await c.env.DB.prepare('UPDATE bhasa_diwas_submissions SET winner_rank = ? WHERE id = ?').bind(i + 1, ids[i]).run();
    }

    const { results: winnerRows } = await c.env.DB
      .prepare(`SELECT * FROM bhasa_diwas_submissions WHERE category = ? AND winner_rank IS NOT NULL ORDER BY winner_rank ASC`)
      .bind(category)
      .all();
    winners[category] = (winnerRows || []).map(toSubmissionJson);
  }

  return c.json({ success: true, winners });
});

// GET /bhasa-diwas/winners -- public. No address/phone (see toSubmissionJson).
bhasaDiwas.get('/winners', async (c) => {
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM bhasa_diwas_submissions WHERE winner_rank IS NOT NULL ORDER BY category ASC, winner_rank ASC`)
    .all();
  return c.json({ documents: (results || []).map(toSubmissionJson) });
});

// GET /bhasa-diwas/winners/full -- service-only (admin-gated by the
// Next.js proxy). Includes the mailing address, for actually sending the
// memento -- never returned by the public /winners route above.
bhasaDiwas.get('/winners/full', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM bhasa_diwas_submissions WHERE winner_rank IS NOT NULL ORDER BY category ASC, winner_rank ASC`)
    .all();
  return c.json({ documents: (results || []).map(toWinnerAdminJson) });
});

// GET /bhasa-diwas/votes?voterId=X -> every submissionId this voter has voted for
bhasaDiwas.get('/votes', async (c) => {
  const voterId = c.req.query('voterId');
  if (!voterId) return c.json({ submissionIds: [] });
  const { results } = await c.env.DB.prepare('SELECT submission_id FROM bhasa_diwas_votes WHERE voter_id = ?').bind(voterId).all();
  return c.json({ submissionIds: (results || []).map((r: any) => r.submission_id) });
});

// POST /bhasa-diwas/votes  { submissionId, voterId } -- service-only,
// called from app/api/bhasa-diwas/vote/route.ts. INSERT relies on D1's
// real UNIQUE(submission_id, voter_id) constraint to detect a repeat vote
// atomically -- stronger than the old Appwrite version, which checked for
// an existing vote with a separate listDocuments() call first (a real
// race the schema.sql comment on bhasa_diwas_votes already calls out).
bhasaDiwas.post('/votes', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);
  if (isBhasaDiwasClosed()) return c.json({ error: 'Voting is closed' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body?.submissionId || !body?.voterId) return c.json({ error: 'submissionId and voterId are required' }, 400);

  const id = crypto.randomUUID();
  const insert = await c.env.DB
    .prepare('INSERT INTO bhasa_diwas_votes (id, submission_id, voter_id) VALUES (?, ?, ?) ON CONFLICT (submission_id, voter_id) DO NOTHING')
    .bind(id, body.submissionId, body.voterId)
    .run();
  if (insert.meta.changes === 0) {
    return c.json({ success: false, error: 'Already voted' }, 400);
  }

  await c.env.DB.prepare('UPDATE bhasa_diwas_submissions SET votes = votes + 1 WHERE id = ?').bind(body.submissionId).run();
  return c.json({ success: true });
});
