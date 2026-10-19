import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';

type Bindings = { DB: D1Database; IMAGES: R2Bucket; AUTH_JWT_SECRET: string };

export const downloads = new Hono<{ Bindings: Bindings }>();

// The /apps page's backend -- an app store. Listings are either added by an
// admin (optionally with a hosted file in the IMAGES R2 bucket under the
// downloads/ prefix) or submitted by any logged-in user, in which case they
// start 'pending' and only appear publicly once an admin approves them.
// Community submissions can only point at links (store pages, a website, an
// external download URL) -- only an admin can attach a hosted file, so
// strangers can't put arbitrary binaries on our storage.

const CATEGORIES = ['apps', 'games', 'magic-tricks', 'game-materials'];
const STATUSES = ['pending', 'approved', 'rejected'];
const KEY_PREFIX = 'downloads/';
const FILE_ID = /^[A-Za-z0-9._-]{1,200}$/;
const MAX_SCREENSHOTS = 8;
const MAX_PENDING_PER_USER = 5;
// Cloudflare caps a request body at ~100MB on most plans; leave headroom.
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150);
  return cleaned || 'download';
}

function parseShots(raw: unknown): string[] {
  try {
    const arr = JSON.parse(typeof raw === 'string' ? raw : '[]');
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string' && FILE_ID.test(x)) : [];
  } catch {
    return [];
  }
}

type View = 'public' | 'owner' | 'admin';

function toJson(row: any, view: View) {
  const base = {
    $id: row.id,
    slug: row.slug || null,
    title: row.title,
    tagline: row.tagline,
    category: row.category,
    description: row.description,
    version: row.version,
    iconFileId: row.icon_file_id,
    screenshots: parseShots(row.screenshots),
    developerName: row.developer_name,
    websiteUrl: row.website_url,
    playStoreUrl: row.play_store_url,
    appStoreUrl: row.app_store_url,
    featured: !!row.featured,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    downloadCount: row.download_count,
    // Only the list query joins these in; 0/null elsewhere.
    ratingCount: row.rating_count || 0,
    ratingAverage: row.rating_avg ? Math.round(row.rating_avg * 10) / 10 : null,
    hosted: !!row.file_key,
    hasDownload: !!(row.file_key || row.external_url),
    createdAt: row.created_at,
  };
  // The external download URL and R2 key stay out of public responses on
  // purpose -- every download goes through /:id/download so it gets counted.
  if (view === 'public') return base;
  const owner = { ...base, status: row.status, rejectionReason: row.rejection_reason, active: !!row.active, developerEmail: row.developer_email };
  if (view === 'owner') return owner;
  return { ...owner, externalUrl: row.external_url, fileKey: row.file_key, submitterId: row.submitter_id };
}

// 'submit' is the static /apps/submit page -- a listing slug of that name
// would be unreachable behind it.
const RESERVED_SLUGS = ['submit'];

function slugBase(title: string): string {
  const s = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '') || 'app';
  return RESERVED_SLUGS.includes(s) ? s + '-app' : s;
}

async function uniqueSlug(db: D1Database, title: string): Promise<string> {
  const base = slugBase(title);
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : base + '-' + crypto.randomUUID().slice(0, 4);
    const hit = await db.prepare('SELECT 1 FROM downloads WHERE slug = ?').bind(candidate).first();
    if (!hit) return candidate;
  }
  return base + '-' + crypto.randomUUID().slice(0, 8);
}

const PUBLIC_WHERE = "active = 1 AND status = 'approved'";

// GET /downloads?category=games&featured=1&q=chess&sort=popular&limit=60
//   -> approved + active entries (public)
// GET /downloads?all=1[&status=pending]  (admin JWT) -> everything / one status;
//   anyone else silently gets the public list.
downloads.get('/', async (c) => {
  const category = c.req.query('category');
  if (category && !CATEGORIES.includes(category)) return c.json({ error: 'Unknown category' }, 400);

  let admin = false;
  if (c.req.query('all') === '1') admin = isAdmin(await verifyUser(c.req.raw, c.env));

  const where: string[] = [];
  const params: unknown[] = [];
  if (!admin) where.push(PUBLIC_WHERE);
  const status = c.req.query('status');
  if (admin && status && STATUSES.includes(status)) { where.push('status = ?'); params.push(status); }
  if (category) { where.push('category = ?'); params.push(category); }
  if (c.req.query('featured') === '1') where.push('featured = 1');
  const q = (c.req.query('q') || '').replace(/[%_]/g, ' ').trim().slice(0, 60);
  if (q) { where.push('(title LIKE ? OR tagline LIKE ?)'); params.push('%' + q + '%', '%' + q + '%'); }

  const order = c.req.query('sort') === 'popular' ? 'download_count DESC, created_at DESC' : 'created_at DESC';
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '500', 10) || 500, 1), 500);

  const sql = `SELECT downloads.*, r.rating_count, r.rating_avg FROM downloads
    LEFT JOIN (SELECT app_id, COUNT(*) AS rating_count, AVG(rating) AS rating_avg FROM app_reviews GROUP BY app_id) r
      ON r.app_id = downloads.id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ${limit}`;
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  const docs = (results || []).map((r: any) => toJson(r, admin ? 'admin' : 'public'));
  if (!admin) c.header('Cache-Control', 'public, max-age=30');
  return c.json({ documents: docs, total: docs.length });
});

// GET /downloads/mine -- the signed-in user's own submissions, any status.
downloads.get('/mine', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB
    .prepare('SELECT * FROM downloads WHERE submitter_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(user.$id)
    .all();
  const docs = (results || []).map((r: any) => toJson(r, 'owner'));
  return c.json({ documents: docs, total: docs.length });
});

// GET /downloads/:ref -- one listing by slug or id. Public once approved;
// before that only an admin or the person who submitted it can see it.
downloads.get('/:ref', async (c) => {
  const ref = c.req.param('ref');
  const row = await c.env.DB.prepare('SELECT * FROM downloads WHERE slug = ? OR id = ? LIMIT 1').bind(ref, ref).first() as any;
  if (!row) return c.json({ error: 'Not found' }, 404);

  const isPublic = !!row.active && row.status === 'approved';
  if (isPublic) {
    c.header('Cache-Control', 'public, max-age=30');
    return c.json(toJson(row, 'public'));
  }
  const user = await verifyUser(c.req.raw, c.env);
  if (isAdmin(user)) return c.json(toJson(row, 'admin'));
  if (user && row.submitter_id && row.submitter_id === user.$id) return c.json(toJson(row, 'owner'));
  return c.json({ error: 'Not found' }, 404);
});

// GET /downloads/:id/download -- the only way a file is ever handed out.
// Counts the download, then either streams the R2 object (with Range
// support, so a large APK on a flaky mobile connection can resume) or
// redirects to the external URL.
downloads.get('/:id/download', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`SELECT * FROM downloads WHERE id = ? AND ${PUBLIC_WHERE}`).bind(id).first() as any;
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

function validUrl(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const s = x.trim();
  if (!s || s.length > 1000) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

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
  for (const [field, max] of [['tagline', 120], ['description', 4000], ['version', 50], ['fileName', 200], ['developerName', 100], ['rejectionReason', 500]] as const) {
    if (field in body) v[field] = body[field] === null ? null : (str(body[field], max) || null);
  }
  if ('developerEmail' in body) {
    const e = body.developerEmail === null ? '' : str(body.developerEmail, 200) || '';
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { values: v, error: 'developerEmail is not a valid email address' };
    v.developerEmail = e || null;
  }
  if ('iconFileId' in body) {
    if (body.iconFileId === null || body.iconFileId === '') v.iconFileId = null;
    else if (typeof body.iconFileId === 'string' && FILE_ID.test(body.iconFileId)) v.iconFileId = body.iconFileId;
    else return { values: v, error: 'iconFileId is not a valid file id' };
  }
  if ('screenshots' in body) {
    if (!Array.isArray(body.screenshots) || body.screenshots.length > MAX_SCREENSHOTS || !body.screenshots.every((s: unknown) => typeof s === 'string' && FILE_ID.test(s))) {
      return { values: v, error: `screenshots must be a list of up to ${MAX_SCREENSHOTS} uploaded images` };
    }
    v.screenshots = JSON.stringify(body.screenshots);
  }
  if ('fileKey' in body) {
    if (body.fileKey === null || body.fileKey === '') v.fileKey = null;
    else if (typeof body.fileKey === 'string' && body.fileKey.startsWith(KEY_PREFIX) && body.fileKey.length <= 500 && !body.fileKey.includes('..')) v.fileKey = body.fileKey;
    else return { values: v, error: 'fileKey is not a valid uploaded file' };
  }
  for (const field of ['externalUrl', 'websiteUrl', 'playStoreUrl', 'appStoreUrl'] as const) {
    if (!(field in body)) continue;
    if (body[field] === null || body[field] === '') { v[field] = null; continue; }
    const u = validUrl(body[field]);
    if (!u) return { values: v, error: field + ' must be an http(s) link' };
    v[field] = u;
  }
  if ('status' in body) {
    if (!STATUSES.includes(body.status)) return { values: v, error: 'status must be one of: ' + STATUSES.join(', ') };
    v.status = body.status;
  }
  if ('active' in body) v.active = body.active ? 1 : 0;
  if ('featured' in body) v.featured = body.featured ? 1 : 0;
  return { values: v };
}

const COLUMN: Record<string, string> = {
  title: 'title', tagline: 'tagline', category: 'category', description: 'description', version: 'version',
  iconFileId: 'icon_file_id', screenshots: 'screenshots', fileKey: 'file_key', fileName: 'file_name', sizeBytes: 'size_bytes',
  externalUrl: 'external_url', websiteUrl: 'website_url', playStoreUrl: 'play_store_url', appStoreUrl: 'app_store_url',
  developerName: 'developer_name', developerEmail: 'developer_email', rejectionReason: 'rejection_reason',
  status: 'status', active: 'active', featured: 'featured', submitterId: 'submitter_id', slug: 'slug',
};

const hasSource = (r: { fileKey?: unknown; externalUrl?: unknown; websiteUrl?: unknown; playStoreUrl?: unknown; appStoreUrl?: unknown }) =>
  !!(r.fileKey || r.externalUrl || r.websiteUrl || r.playStoreUrl || r.appStoreUrl);

async function insertRow(db: D1Database, values: Record<string, unknown>): Promise<string> {
  const id = crypto.randomUUID();
  const withSlug = { ...values, slug: await uniqueSlug(db, String(values.title)) };
  const keys = Object.keys(withSlug);
  await db
    .prepare(`INSERT INTO downloads (id, ${keys.map((k) => COLUMN[k]).join(', ')}) VALUES (?, ${keys.map(() => '?').join(', ')})`)
    .bind(id, ...Object.values(withSlug))
    .run();
  return id;
}

// POST /downloads/submit -- any logged-in user. Creates a 'pending' listing
// an admin has to approve. Only listing fields are accepted: no hosted file,
// and status/featured/active are not the submitter's to set.
downloads.post('/submit', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Please log in to submit an app' }, 401);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON' }, 400);

  const allowed = ['title', 'tagline', 'category', 'description', 'version', 'developerName', 'developerEmail', 'websiteUrl', 'playStoreUrl', 'appStoreUrl', 'externalUrl', 'iconFileId', 'screenshots'];
  const picked: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) picked[k] = body[k];

  const { values, error } = parseFields(picked);
  if (error) return c.json({ error }, 400);
  if (!values.title || String(values.title).length > 80) return c.json({ error: 'Give your app a name (up to 80 characters)' }, 400);
  if (!values.tagline) return c.json({ error: 'Add a one-line tagline' }, 400);
  if (!values.category) return c.json({ error: 'Pick a category' }, 400);
  if (!values.description || String(values.description).length < 20) return c.json({ error: 'Describe your app in at least a couple of sentences' }, 400);
  if (!values.iconFileId) return c.json({ error: 'Upload an app icon' }, 400);
  if (!values.developerName) return c.json({ error: 'Add the developer or team name' }, 400);
  if (!hasSource(values)) return c.json({ error: 'Add at least one link where people can get the app' }, 400);

  const pending = await c.env.DB
    .prepare("SELECT COUNT(*) AS n FROM downloads WHERE submitter_id = ? AND status = 'pending'")
    .bind(user.$id)
    .first() as any;
  if ((pending?.n || 0) >= MAX_PENDING_PER_USER) {
    return c.json({ error: `You already have ${MAX_PENDING_PER_USER} submissions waiting for review -- please wait for those first` }, 429);
  }

  if (!values.developerEmail) values.developerEmail = user.email;
  const id = await insertRow(c.env.DB, { ...values, status: 'pending', active: 1, featured: 0, submitterId: user.$id });
  return c.json({ ok: true, id });
});

// POST /downloads -- admin only. Needs at least one way to get the app: a
// hosted file (fileKey from /upload), an externalUrl, or a website / store
// link. The size always comes from R2's own record of the object, never from
// what the client claims. Admin-added entries are approved straight away.
downloads.post('/', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const { values, error } = parseFields(body);
  if (error) return c.json({ error }, 400);
  if (!values.title || !values.category) return c.json({ error: 'title and category are required' }, 400);
  if (!hasSource(values)) return c.json({ error: 'Add a file (upload it first), an external download link, or a website / store link' }, 400);

  if (values.fileKey) {
    const head = await c.env.IMAGES.head(values.fileKey as string);
    if (!head) return c.json({ error: 'That uploaded file was not found -- upload it again' }, 400);
    values.sizeBytes = head.size;
  }

  const id = await insertRow(c.env.DB, { status: 'approved', ...values });
  return c.json({ ok: true, id });
});

// PATCH /downloads/:id -- admin only, partial. Replacing the hosted file
// deletes the old R2 object so replaced uploads don't pile up. Approving a
// listing clears any earlier rejection reason.
downloads.patch('/:id', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM downloads WHERE id = ?').bind(id).first() as any;
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const { values, error } = parseFields(body);
  if (error) return c.json({ error }, 400);

  const merged = {
    fileKey: 'fileKey' in values ? values.fileKey : existing.file_key,
    externalUrl: 'externalUrl' in values ? values.externalUrl : existing.external_url,
    websiteUrl: 'websiteUrl' in values ? values.websiteUrl : existing.website_url,
    playStoreUrl: 'playStoreUrl' in values ? values.playStoreUrl : existing.play_store_url,
    appStoreUrl: 'appStoreUrl' in values ? values.appStoreUrl : existing.app_store_url,
  };
  if (!hasSource(merged)) return c.json({ error: 'An entry needs a hosted file, a download link, or a website / store link' }, 400);

  if ('fileKey' in values && values.fileKey) {
    const head = await c.env.IMAGES.head(values.fileKey as string);
    if (!head) return c.json({ error: 'That uploaded file was not found -- upload it again' }, 400);
    values.sizeBytes = head.size;
  }
  if ('fileKey' in values && !values.fileKey) values.sizeBytes = null;
  if (values.status === 'approved' && !('rejectionReason' in values)) values.rejectionReason = null;

  const keys = Object.keys(values);
  if (keys.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  const sets = keys.map((k) => `${COLUMN[k]} = ?`).concat("updated_at = datetime('now')");
  await c.env.DB.prepare(`UPDATE downloads SET ${sets.join(', ')} WHERE id = ?`).bind(...Object.values(values), id).run();

  if ('fileKey' in values && existing.file_key && existing.file_key !== values.fileKey) {
    c.executionCtx.waitUntil(c.env.IMAGES.delete(existing.file_key));
  }
  return c.json({ ok: true });
});

// DELETE /downloads/:id -- an admin can delete anything; a submitter can
// withdraw their own listing until it's approved. Removes the row and its
// hosted file. Icon/screenshot images are deliberately left in place: they
// live in the shared bucket root, and a submission is free to reference an
// image that something else (an article) also uses.
downloads.delete('/:id', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT file_key, submitter_id, status FROM downloads WHERE id = ?').bind(id).first() as any;
  if (!row) return c.json({ ok: true }); // already gone -- deleting is idempotent

  const ownWithdraw = !!row.submitter_id && row.submitter_id === user.$id && row.status !== 'approved';
  if (!isAdmin(user) && !ownWithdraw) return c.json({ error: 'Unauthorized' }, 401);

  await c.env.DB.prepare('DELETE FROM downloads WHERE id = ?').bind(id).run();
  if (row.file_key) c.executionCtx.waitUntil(c.env.IMAGES.delete(row.file_key));
  return c.json({ ok: true });
});
