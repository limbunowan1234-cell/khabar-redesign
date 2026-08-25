import { Hono } from 'hono';
import { verifyUser, isReporterOrAdmin } from '../lib/auth';

type Bindings = { DB: D1Database };

export const photos = new Hono<{ Bindings: Bindings }>();

function toPhotoJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    imageFileId: row.image_file_id,
    type: row.type,
    title: row.title,
    slug: row.slug,
  };
}

// GET /photos?type=ad&limit=100 -- public read. AdBanner shows this to
// every visitor including logged out ones (type=ad); admin's gallery
// (app/admin/page.tsx) reads every type with no filter.
photos.get('/', async (c) => {
  const q = c.req.query();
  const limit = Math.min(parseInt(q.limit || '100', 10) || 100, 200);
  const where: string[] = ['1=1'];
  const params: unknown[] = [];
  if (q.type) { where.push('type = ?'); params.push(q.type); }

  const sql = `SELECT * FROM photos WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(...params, limit).all();
  return c.json({ documents: (results || []).map(toPhotoJson) });
});

// POST /photos  { imageFileId, type, title } -- reporter/admin only,
// matches admin/page.tsx's own "Photos" tab access (available to any
// reporter, not just admins -- Weekly/Certificates are the admin-only
// tabs on that page).
photos.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!user || !isReporterOrAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body?.imageFileId) return c.json({ error: 'imageFileId is required' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare('INSERT INTO photos (id, image_file_id, type, title) VALUES (?, ?, ?, ?)')
    .bind(id, body.imageFileId, body.type || 'story', body.title || null)
    .run();
  return c.json({ ok: true, id });
});

// DELETE /photos/:id -- reporter/admin only.
photos.delete('/:id', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!user || !isReporterOrAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);
  await c.env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
