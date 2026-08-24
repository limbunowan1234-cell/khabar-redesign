import { Hono } from 'hono';
import { verifyUser } from '../lib/auth';

type Bindings = { IMAGES: R2Bucket };

export const cdn = new Hono<{ Bindings: Bindings }>();

// No transform layer here on purpose — R2 has none at all, unlike
// Appwrite's /preview (which also silently failed to decode AVIF).
// Files are served exactly as uploaded; next/image handles resizing
// client-side, same permanent pattern documented in the migration plan.
async function serve(c: any, bucket: R2Bucket, key: string) {
  const object = await bucket.get(key);
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}

// GET /cdn/articles/{fileId}.{ext} — maps to Appwrite bucket `article-image`.
cdn.get('/articles/:key', (c) => serve(c, c.env.IMAGES, c.req.param('key')));

// POST /cdn/articles — multipart/form-data, field name "file". Week 39 of
// the Cloudflare migration (see cloudflare/README.md): this bucket had
// been read-only on R2 since some earlier week -- reads worked because
// something outside this repo (an Appwrite Function, by all appearances)
// was mirroring every Appwrite Storage upload into R2 automatically.
// That's invisible to this codebase and would stop the moment Appwrite is
// cancelled, so this is a real upload path, not a formality. Any
// logged-in user, matching POST /articles's own boundary -- image upload
// happens as part of article/photo-story creation, open to any logged-in
// contributor, not just reporters/admins.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
cdn.post('/articles', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get('file') as File | null;
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return c.json({ error: 'file is required' }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: 'File too large (max 10MB)' }, 400);

  const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = crypto.randomUUID() + (ext ? '.' + ext : '');
  await c.env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  return c.json({ fileId: key });
});
