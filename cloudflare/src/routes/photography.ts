import { Hono } from 'hono';
import { verifyUser, isPhotographer } from '../lib/auth';

type Bindings = { DB: D1Database };

export const photography = new Hono<{ Bindings: Bindings }>();

function toPhotoJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    title: row.title,
    caption: row.caption,
    location: row.location,
    imageFileId: row.image_file_id,
    submitterId: row.submitter_id,
    submitterName: row.submitter_name,
  };
}

// GET /photography?submitterId=X&limit=100 -- public read (Hills in Frame
// is a public gallery). submitterId narrows to one photographer's own
// photos, for hills-in-frame/post/page.tsx's "My Photos" list.
photography.get('/', async (c) => {
  const q = c.req.query();
  const limit = Math.min(parseInt(q.limit || '50', 10) || 50, 200);
  const where: string[] = ['1=1'];
  const params: unknown[] = [];
  if (q.submitterId) { where.push('submitter_id = ?'); params.push(q.submitterId); }

  const sql = `SELECT * FROM photography WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(...params, limit).all();
  return c.json({ documents: (results || []).map(toPhotoJson) });
});

// POST /photography  { title, caption, location?, imageFileId } --
// photographer-role only, matches hills-in-frame/post/page.tsx's own
// gate (a separate role from reporter/admin).
photography.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!user || !isPhotographer(user)) return c.json({ error: 'Photographer access required' }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body?.title || !body?.caption || !body?.imageFileId) {
    return c.json({ error: 'title, caption, and imageFileId are required' }, 400);
  }

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO photography (id, title, caption, location, image_file_id, submitter_id, submitter_name)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, body.title, body.caption, body.location || null, body.imageFileId, user.$id, user.name || 'Photographer')
    .run();
  return c.json({ success: true, id });
});

// PATCH /photography/:id  { title, caption, location?, imageFileId } --
// own-photo only.
photography.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await verifyUser(c.req.raw);
  if (!user || !isPhotographer(user)) return c.json({ error: 'Photographer access required' }, 403);

  const row = await c.env.DB.prepare('SELECT submitter_id FROM photography WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if ((row as any).submitter_id !== user.$id) return c.json({ error: 'You can only edit your own photos' }, 403);

  const body = await c.req.json().catch(() => null);
  if (!body?.title || !body?.caption || !body?.imageFileId) {
    return c.json({ error: 'title, caption, and imageFileId are required' }, 400);
  }

  await c.env.DB
    .prepare('UPDATE photography SET title = ?, caption = ?, location = ?, image_file_id = ? WHERE id = ?')
    .bind(body.title, body.caption, body.location || null, body.imageFileId, id)
    .run();
  return c.json({ success: true });
});

// DELETE /photography/:id -- own-photo only.
photography.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await verifyUser(c.req.raw);
  if (!user || !isPhotographer(user)) return c.json({ error: 'Photographer access required' }, 403);

  const row = await c.env.DB.prepare('SELECT submitter_id FROM photography WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if ((row as any).submitter_id !== user.$id) return c.json({ error: 'You can only delete your own photos' }, 403);

  await c.env.DB.prepare('DELETE FROM photography WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});
