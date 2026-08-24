import { Hono } from 'hono';
import { verifyService } from '../lib/auth';

type Bindings = { DB: D1Database; SERVICE_SECRET: string };

export const bhasaDiwas = new Hono<{ Bindings: Bindings }>();

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

bhasaDiwas.route('/submissions', submissions);

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
