import { Hono } from 'hono';
import { verifyUser, verifyService, isSuspended } from '../lib/auth';

type Bindings = { IMAGES: R2Bucket; DB: D1Database; AUTH_JWT_SECRET: string; SERVICE_SECRET: string };

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
  // Never let a browser guess a different type (e.g. treat an upload as HTML).
  headers.set('x-content-type-options', 'nosniff');
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

// Works out what an upload really is from its first bytes, ignoring the
// file name and the type the browser claims. Only these image formats are
// accepted for article photos, avatars and app icons.
export function sniffImage(b: Uint8Array): { type: string; ext: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 4) === 'PNG') return { type: 'image/png', ext: 'png' };
  if (b.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return { type: 'image/gif', ext: 'gif' };
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  if (b.length >= 12 && ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return { type: 'image/avif', ext: 'avif' };
  return null;
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
  const user = await verifyUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  if (await isSuspended(c.env.DB, user.$id)) {
    return c.json({ error: 'Your account can no longer upload. Contact nowanad@gmail.com.' }, 403);
  }

  const file = await readUploadedFile(c);
  if (!file) return c.json({ error: 'file is required (max 10MB)' }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return c.json({ error: 'Only JPEG, PNG, WebP, GIF or AVIF images can be uploaded.' }, 415);

  const key = crypto.randomUUID() + '.' + kind.ext;
  await c.env.IMAGES.put(key, bytes, { httpMetadata: { contentType: kind.type } });

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
