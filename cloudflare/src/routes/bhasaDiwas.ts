import { Hono } from 'hono';

type Bindings = { DB: D1Database };

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

bhasaDiwas.route('/submissions', submissions);

// GET /bhasa-diwas/votes?voterId=X -> every submissionId this voter has voted for
bhasaDiwas.get('/votes', async (c) => {
  const voterId = c.req.query('voterId');
  if (!voterId) return c.json({ submissionIds: [] });
  const { results } = await c.env.DB.prepare('SELECT submission_id FROM bhasa_diwas_votes WHERE voter_id = ?').bind(voterId).all();
  return c.json({ submissionIds: (results || []).map((r: any) => r.submission_id) });
});
