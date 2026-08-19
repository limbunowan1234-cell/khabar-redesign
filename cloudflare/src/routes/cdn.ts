import { Hono } from 'hono';

type Bindings = { IMAGES: R2Bucket; DOWNLOADS: R2Bucket };

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

// GET /cdn/apk/{version}.apk — maps to Appwrite bucket `app-downloads`.
cdn.get('/apk/:key', (c) => serve(c, c.env.DOWNLOADS, c.req.param('key')));
