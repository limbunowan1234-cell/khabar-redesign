import { Hono } from 'hono';
import { verifyUser, verifyService } from '../lib/auth';

type Bindings = { IMAGES: R2Bucket; SERVICE_SECRET: string };

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

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Shared by every /cdn upload route below. Returns the validated File, or
// writes an error response to `err` and returns null.
async function readUploadedFile(c: any): Promise<File | null> {
  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get('file') as File | null;
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return null;
  }
  if (file.size > MAX_UPLOAD_BYTES) return null;
  return file;
}

function keyFor(file: File): string {
  const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return crypto.randomUUID() + (ext ? '.' + ext : '');
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
cdn.post('/articles', async (c) => {
  const user = await verifyUser(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const file = await readUploadedFile(c);
  if (!file) return c.json({ error: 'file is required (max 10MB)' }, 400);

  const key = keyFor(file);
  await c.env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  return c.json({ fileId: key });
});

// GET /cdn/bhasa-diwas/{fileId}.{ext} — same IMAGES bucket as articles,
// just a different key prefix (see the POST route below) so the two
// namespaces can't collide. Public, matches /cdn/articles's own read
// boundary -- this is public contest content either way.
cdn.get('/bhasa-diwas/:key', (c) => serve(c, c.env.IMAGES, 'bhasa-diwas/' + c.req.param('key')));

// POST /cdn/bhasa-diwas — multipart/form-data, field name "file". Week 40
// of the Cloudflare migration: photo-category Bhasa Diwas submissions
// used to upload to a separate Appwrite Storage bucket
// (6a67a307002f71e8dcf5) with no R2 mirror at all -- unlike article
// images, these were never viewable through R2, only ever through
// Appwrite Storage directly via /api/image-proxy. Service-secret gated,
// not JWT -- the caller here is app/api/bhasa-diwas/submit/route.ts
// itself (the browser uploads to that Next.js route, which uploads here
// server-to-server), the same shape as that route's D1 write since Week
// 38, not a browser-direct call like POST /articles.
cdn.post('/bhasa-diwas', async (c) => {
  if (!verifyService(c.req.raw, c.env)) return c.json({ error: 'Unauthorized' }, 401);

  const file = await readUploadedFile(c);
  if (!file) return c.json({ error: 'file is required (max 10MB)' }, 400);

  const key = keyFor(file);
  await c.env.IMAGES.put('bhasa-diwas/' + key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  return c.json({ fileId: key });
});
