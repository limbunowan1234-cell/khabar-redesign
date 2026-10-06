import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';

type Bindings = { DB: D1Database; IMAGES: R2Bucket; AUTH_JWT_SECRET: string };

export const downloads = new Hono<{ Bindings: Bindings }>();

// The /apps page's backend: a catalogue of downloadable apps, games,
// magic-trick apps and game materials. Files live in the IMAGES R2 bucket
// under the downloads/ prefix (same bucket the bhasa-diwas/ images use,
// so no new bucket); anything too big to push through a Worker can instead
// be registered by external_url.

const CATEGORIES = ['apps', 'games', 'magic-tricks', 'game-materials'];
const KEY_PREFIX = 'downloads/';
// Cloudflare caps a request body at ~100MB on most plans; leave headroom.
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150);
  return cleaned || 'download';
}

function toJson(row: any, admin: boolean) {
  const base = {
    $id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    version: row.version,
    iconFileId: row.icon_file_id,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    downloadCount: row.download_count,
    hosted: !!row.file_key,
    createdAt: row.created_at,
  };
  // The external URL and R2 key stay out of the public list on purpose --
  // every download goes through /:id/download so it gets counted.
  return admin ? { ...base, active: !!row.active, externalUrl: row.external_url, fileKey: row.file_key } : base;
}

// GET /downloads?category=games       -> active entries (public)
// GET /downloads?all=1  (admin JWT)    -> including inactive; anyone else
//                                         silently gets the public list.
downloads.get('/', async (c) => {
  const category = c.req.query('category');
  if (category && !CATEGORIES.includes(category)) return c.json({ error: 'Unknown category' }, 400);

  let admin = false;
  if (c.req.query('all') === '1') admin = isAdmin(await verifyUser(c.req.raw, c.env));

  const where: string[] = [];
  const params: unknown[] = [];
  if (!admin) where.push('active = 1');
  if (category) { where.push('category = ?'); params.push(category); }

  const sql = `SELECT * FROM downloads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`;
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  const docs = (results || []).map((r: any) => toJson(r, admin));
  return c.json({ documents: docs, total: docs.length });
});

// GET /downloads/:id/download -- the only way a file is ever handed out.
// Counts the download, then either streams the R2 object (with Range
// support, so a large APK on a flaky mobile connection can resume) or
// redirects to the external URL.
downloads.get('/:id/download', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM downloads WHERE id = ? AND active = 1').bind(id).first() as any;
  if (!row) return c.notFound();

  // Count once per download -- not for HEAD probes, and not again for each
  // resumed chunk (only a request that starts from byte 0 counts).
  const rangeHeader = c.req.header('Range');
  const startsFresh = !rangeHeader || /^bytes=0-/.test(rangeHeader);
  if (c.req.method === 'GET' && startsFresh) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE downloads SET download_count = download_count + 1 WHERE id = ?').bind(id).run()
    );
  }

  if (!row.file_key) {
    if (!row.external_url) return c.notFound();
    return c.redirect(row.external_url, 302);
  }

  const object = await c.env.IMAGES.get(row.file_key, rangeHeader ? { range: c.req.raw.headers } : undefined);
  if (!object) return c.notFound();

  const fileName = sanitizeFileName(row.file_name || row.title);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('content-disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'public, max-age=3600');

  let status = 200;
  const r = (object as any).range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (rangeHeader && r) {
    const offset = r.suffix !== undefined ? Math.max(0, object.size - r.suffix) : (r.offset ?? 0);
    const length = r.suffix !== undefined ? object.size - offset : (r.length ?? object.size - offset);
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    status = 206;
  } else {
    headers.set('content-length', String(object.size));
  }
  return new Response((object as R2ObjectBody).body, { status, headers });
});

// PUT /downloads/upload?name=game.apk -- admin only. The file is the raw
// request body, streamed straight into R2 (no multipart, no buffering --
// an APK is far bigger than the 10MB images /cdn/articles takes, and
// buffering it would blow the Worker's memory limit). Returns the R2 key to
// attach to a catalogue entry via POST /downloads.
downloads.put('/upload', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);

  const name = (c.req.query('name') || '').trim();
  if (!name) return c.json({ error: 'name is required' }, 400);

  const length = Number(c.req.header('Content-Length'));
  if (!Number.isFinite(length) || length <= 0) return c.json({ error: 'Content-Length is required' }, 411);
  if (length > MAX_UPLOAD_BYTES) {
    return c.json({ error: 'File is over the 90MB upload limit -- host it elsewhere and add it by external link instead' }, 413);
  }
  if (!c.req.raw.body) return c.json({ error: 'Empty body' }, 400);

  const fileName = sanitizeFileName(name);
  const key = KEY_PREFIX + crypto.randomUUID() + '/' + fileName;
  const isApk = /\.apk$/i.test(fileName);
  const contentType = isApk ? 'application/vnd.android.package-archive' : (c.req.header('Content-Type') || 'application/octet-stream');

  await c.env.IMAGES.put(key, c.req.raw.body, { httpMetadata: { contentType } });
  return c.json({ fileKey: key, fileName, sizeBytes: length });
});

type Parsed = { values: Record<string, unknown>; error?: string };

// Validates the whitelisted fields present in `body`. Fields that are
// absent are left alone; null clears the optional ones.
function parseFields(body: any): Parsed {
  const v: Record<string, unknown> = {};
  const str = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : undefined);

  if ('title' in body) {
    const t = str(body.title, 200);
    if (!t) return { values: v, error: 'title is required' };
    v.title = t;
  }
  if ('category' in body) {
    if (!CATEGORIES.includes(body.category)) return { values: v, error: 'category must be one of: ' + CATEGORIES.join(', ') };
    v.category = body.category;
  }
  for (const [field, max] of [['description', 4000], ['version', 50], ['fileName', 200]] as const) {
    if (field in body) v[field] = body[field] === null ? null : (str(body[field], max) || null);
  }
  if ('iconFileId' in body) {
    if (body.iconFileId === null || body.iconFileId === '') v.iconFileId = null;
    else if (typeof body.iconFileId === 'string' && /^[A-Za-z0-9._-]{1,200}$/.test(body.iconFileId)) v.iconFileId = body.iconFileId;
    else return { values: v, error: 'iconFileId is not a valid file id' };
  }
  if ('fileKey' in body) {
    if (body.fileKey === null || body.fileKey === '') v.fileKey = null;
    else if (typeof body.fileKey === 'string' && body.fileKey.startsWith(KEY_PREFIX) && body.fileKey.length <= 500 && !body.fileKey.includes('..')) v.fileKey = body.fileKey;
    else return { values: v, error: 'fileKey is not a valid uploaded file' };
  }
  if ('externalUrl' in body) {
    if (body.externalUrl === null || body.externalUrl === '') v.externalUrl = null;
    else if (typeof body.externalUrl === 'string' && /^https?:\/\//i.test(body.externalUrl.trim()) && body.externalUrl.length <= 1000) v.externalUrl = body.externalUrl.trim();
    else return { values: v, error: 'externalUrl must be an http(s) link' };
  }
  if ('active' in body) v.active = body.active ? 1 : 0;
  return { values: v };
}

const COLUMN: Record<string, string> = {
  title: 'title', category: 'category', description: 'description', version: 'version',
  iconFileId: 'icon_file_id', fileKey: 'file_key', fileName: 'file_name', sizeBytes: 'size_bytes',
  externalUrl: 'external_url', active: 'active',
};

// POST /downloads -- admin only. Needs a hosted file (fileKey from /upload)
// or an externalUrl. The size always comes from R2's own record of the
// object, never from what the client claims.
downloads.post('/', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const { values, error } = parseFields(body);
  if (error) return c.json({ error }, 400);
  if (!values.title || !values.category) return c.json({ error: 'title and category are required' }, 400);
  if (!values.fileKey && !values.externalUrl) return c.json({ error: 'Add a file (upload it first) or an external link' }, 400);

  if (values.fileKey) {
    const head = await c.env.IMAGES.head(values.fileKey as string);
    if (!head) return c.json({ error: 'That uploaded file was not found -- upload it again' }, 400);
    values.sizeBytes = head.size;
  }

  const id = crypto.randomUUID();
  const cols = ['id', ...Object.keys(values).map((k) => COLUMN[k])];
  const vals = [id, ...Object.values(values)];
  await c.env.DB
    .prepare(`INSERT INTO downloads (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .bind(...vals)
    .run();
  return c.json({ ok: true, id });
});

// PATCH /downloads/:id -- admin only, partial. Replacing the hosted file
// deletes the old R2 object so replaced uploads don't pile up.
downloads.patch('/:id', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT file_key, external_url FROM downloads WHERE id = ?').bind(id).first() as any;
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const { values, error } = parseFields(body);
  if (error) return c.json({ error }, 400);

  const newKey = 'fileKey' in values ? (values.fileKey as string | null) : existing.file_key;
  const newUrl = 'externalUrl' in values ? (values.externalUrl as string | null) : existing.external_url;
  if (!newKey && !newUrl) return c.json({ error: 'An entry needs a hosted file or an external link' }, 400);

  if ('fileKey' in values && values.fileKey) {
    const head = await c.env.IMAGES.head(values.fileKey as string);
    if (!head) return c.json({ error: 'That uploaded file was not found -- upload it again' }, 400);
    values.sizeBytes = head.size;
  }
  if ('fileKey' in values && !values.fileKey) values.sizeBytes = null;

  const keys = Object.keys(values);
  if (keys.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  const sets = keys.map((k) => `${COLUMN[k]} = ?`).concat("updated_at = datetime('now')");
  await c.env.DB.prepare(`UPDATE downloads SET ${sets.join(', ')} WHERE id = ?`).bind(...Object.values(values), id).run();

  if ('fileKey' in values && existing.file_key && existing.file_key !== values.fileKey) {
    c.executionCtx.waitUntil(c.env.IMAGES.delete(existing.file_key));
  }
  return c.json({ ok: true });
});

// DELETE /downloads/:id -- admin only. Removes the row and its hosted file.
downloads.delete('/:id', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT file_key FROM downloads WHERE id = ?').bind(id).first() as any;
  if (!row) return c.json({ ok: true }); // already gone -- deleting is idempotent
  await c.env.DB.prepare('DELETE FROM downloads WHERE id = ?').bind(id).run();
  if (row.file_key) c.executionCtx.waitUntil(c.env.IMAGES.delete(row.file_key));
  return c.json({ ok: true });
});
