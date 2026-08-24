import { Hono } from 'hono';
import { verifyUser, isReporterOrAdmin } from '../lib/auth';

type Bindings = { DB: D1Database };

export const articles = new Hono<{ Bindings: Bindings }>();

// Maps a D1 row (snake_case) back to the shape Appwrite documents already
// have (camelCase + $id) so the ~73 call sites in the Next.js app can swap
// their fetch URL to this Worker without also rewriting how they read the
// response — that rewrite can happen gradually, call site by call site,
// instead of being a single all-at-once change blocking this migration.
function toArticleJson(row: any) {
  return {
    $id: row.id,
    $createdAt: row.created_at,
    $updatedAt: row.updated_at,
    slug: row.slug,
    title: row.title,
    sideHeader: row.side_header,
    content: row.content,
    genre: row.genre,
    category: row.category,
    status: row.status,
    locationDistrict: row.location_district,
    locationArea: row.location_area,
    imageFileId: row.image_file_id,
    imageCaption: row.image_caption,
    youtube_id: row.youtube_id,
    submitterId: row.submitter_id,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    submitterAvatar: row.submitter_avatar,
    authorName: row.author_name,
    authorEmail: row.author_email,
    views: row.views,
    isBreaking: !!row.is_breaking,
    isFeatured: !!row.is_featured,
    isContestEntry: !!row.is_contest_entry,
    isWeeklyPick: !!row.is_weekly_pick,
    weeklyLive: !!row.weekly_live,
    weeklyIssue: row.weekly_issue,
    weeklySection: row.weekly_section,
    weeklyOrder: row.weekly_order,
    isWeeklyLead: !!row.is_weekly_lead,
    isGenreFeatured: !!row.is_genre_featured,
    isGenrePinned: !!row.is_genre_pinned,
    isRegionFeatured: !!row.is_region_featured,
    isRegionPinned: !!row.is_region_pinned,
    rejectionReason: row.rejection_reason,
    trackerData: row.tracker_data,
    location: row.location,
    publishedAt: row.published_at,
    submittedAt: row.submitted_at,
  };
}

// Homepage requests up to 300 (app/HomeClient.tsx), sitemaps up to 1000
// (app/sitemap.ts, app/image-sitemap.xml/route.ts) — none of these have
// pagination UI, they just want everything published in one round trip.
const MAX_LIMIT = 1000;

// GET /articles?status=published&district=Darjeeling&genre=...&breaking=1&featured=1&contest=1&limit=20&cursor=<createdAt>
articles.get('/', async (c) => {
  const q = c.req.query();
  const limit = Math.min(parseInt(q.limit || '20', 10) || 20, MAX_LIMIT);

  // Filters that define the matching set (used for both the page query and
  // the total count). Cursor is pagination-only, so it's applied separately
  // to the page query — total reflects the whole filtered set, matching how
  // Appwrite's listDocuments().total behaves regardless of pagination.
  // Seeded with an always-true sentinel so `where` is never empty -- a
  // verified reporter/admin hitting status=all with no other filter (the
  // admin dashboard's exact call) previously left `where` empty, producing
  // `WHERE  ORDER BY ...` -- invalid SQL, a 500 on every load. Only
  // possible to hit with a real verified JWT, which is exactly the one
  // path curl-only testing never exercised this whole migration.
  const where: string[] = ['1=1'];
  const params: unknown[] = [];

  // status=all opts out of the default published-only filter. Two valid
  // shapes, both needing a verified identity since this is the one filter
  // that can expose non-public data:
  //  - status=all&submitterId=X -- an author's own dashboard, sees only
  //    their own pending/rejected/draft articles. JWT must match X.
  //  - status=all with no submitterId -- the admin/reporter dashboard
  //    (app/admin/page.tsx), sees every article regardless of author.
  //    JWT must belong to a reporter or admin (see ../lib/auth.ts).
  // Anyone else, or no/invalid JWT, silently gets published-only instead
  // of a 401 that would leak "yes, that's a valid user id."
  if (q.status === 'all' && q.submitterId) {
    const user = await verifyUser(c.req.raw);
    if (user && user.$id === q.submitterId) {
      // no status filter at all -- every status for this one author
    } else {
      where.push('status = ?');
      params.push('published');
    }
  } else if (q.status === 'all') {
    const user = await verifyUser(c.req.raw);
    if (user && isReporterOrAdmin(user)) {
      // no status filter at all -- every status, every author
    } else {
      where.push('status = ?');
      params.push('published');
    }
  } else {
    where.push('status = ?');
    params.push(q.status || 'published');
  }

  if (q.district) { where.push('location_district = ?'); params.push(q.district); }
  if (q.genre) { where.push('genre = ?'); params.push(q.genre); }
  if (q.breaking) { where.push('is_breaking = 1'); }
  if (q.featured) { where.push('is_featured = 1'); }
  if (q.contest) { where.push('is_contest_entry = 1'); }
  if (q.submitterId) { where.push('submitter_id = ?'); params.push(q.submitterId); }
  // admin's weekly-picks management (app/admin/page.tsx) -- next-issue
  // lookup and the pending-picks list both need these.
  if (q.weeklyLive === '1') { where.push('weekly_live = 1'); }
  if (q.weeklyLive === '0') { where.push('weekly_live = 0'); }
  if (q.isWeeklyPick === '1') { where.push('is_weekly_pick = 1'); }
  if (q.ids) {
    const ids = q.ids.split(',').filter(Boolean);
    if (ids.length === 0) return c.json({ documents: [], total: 0, nextCursor: null });
    where.push(`id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }

  const whereSql = where.join(' AND ');

  // Whitelisted, never built from raw query input directly -- avoids any
  // SQL-injection surface in an ORDER BY clause. weekly_issue is stored as
  // TEXT (matches Appwrite's own numeric-string values) -- CAST to sort
  // numerically ("10" would otherwise sort before "2" as plain text).
  const SORT_MAP: Record<string, string> = {
    createdAtDesc: 'created_at DESC',
    weeklyIssueDesc: 'CAST(weekly_issue AS INTEGER) DESC',
    weeklyOrderAsc: 'weekly_order ASC',
  };
  const sortSql = SORT_MAP[q.sort || ''] || SORT_MAP.createdAtDesc;

  const pageWhere = q.cursor ? `${whereSql} AND created_at < ?` : whereSql;
  const pageParams = q.cursor ? [...params, q.cursor] : params;

  const sql = `SELECT * FROM articles WHERE ${pageWhere} ORDER BY ${sortSql} LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(...pageParams, limit).all();
  const docs = (results || []).map(toArticleJson);
  const nextCursor = docs.length === limit && sortSql === SORT_MAP.createdAtDesc ? (results![results!.length - 1] as any).created_at : null;

  const countRow = await c.env.DB
    .prepare(`SELECT COUNT(*) as total FROM articles WHERE ${whereSql}`)
    .bind(...params)
    .first();

  return c.json({ documents: docs, total: (countRow as any)?.total ?? 0, nextCursor });
});

// GET /articles/:idOrSlug — matches Appwrite's getArticle() fallback
// behavior (try as document id first, then as slug).
articles.get('/:idOrSlug', async (c) => {
  const idOrSlug = c.req.param('idOrSlug');

  let row = await c.env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(idOrSlug).first();
  if (!row) {
    row = await c.env.DB.prepare('SELECT * FROM articles WHERE slug = ?').bind(idOrSlug).first();
  }
  if (!row) return c.json({ error: 'Not found' }, 404);

  const supporting = await c.env.DB
    .prepare('SELECT file_id, caption FROM article_supporting_images WHERE article_id = ? ORDER BY sort_order')
    .bind((row as any).id)
    .all();

  // Appwrite stored these as an array of JSON strings (`{"fileId":...,
  // "caption":...}`), not parsed objects — app/article/[id]/ArticleClient.tsx's
  // renderContent() does its own JSON.parse() on each entry, so this
  // mirrors that shape exactly rather than pre-parsing it.
  const supportingImages = (supporting.results || []).map((r: any) =>
    JSON.stringify({ fileId: r.file_id, caption: r.caption })
  );

  // Photo-story articles only -- a flat array of file id strings (no
  // caption), matching ArticleClient.tsx's gallery viewer.
  const gallery = await c.env.DB
    .prepare('SELECT file_id FROM article_gallery_images WHERE article_id = ? ORDER BY sort_order')
    .bind((row as any).id)
    .all();
  const galleryImageIds = (gallery.results || []).map((r: any) => r.file_id);

  return c.json({ ...toArticleJson(row), supportingImages, galleryImageIds });
});

// PATCH /articles/:id/views — the one write endpoint Phase 1 needs, since
// incrementViews() fires on every single article page load and there's no
// value in leaving that on Appwrite while everything else reads from D1.
articles.patch('/:id/views', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB
    .prepare('UPDATE articles SET views = views + 1 WHERE id = ? RETURNING views')
    .bind(id)
    .first();
  if (!result) return c.json({ error: 'Not found' }, 404);
  return c.json({ views: (result as any).views });
});

// --- Shadow-write only (see cloudflare/README.md) ---
// Appwrite stays authoritative for all three of these.

// POST /articles -- creates a new article. `id` is the real Appwrite
// document $id, passed through by the caller after the real create
// succeeds (Appwrite generates it via documentId: 'unique()', same
// reasoning as comments.ts: later edits/deletes need both systems to
// agree on the id). JWT must belong to the exact submitterId in the
// body -- matches the real app's current access model (app/post/page.tsx
// lets any logged-in user create an article, not just reporters/admins;
// the reporter/admin UI's own tighter gating is enforced client-side
// only, not something this migration should silently invent).
articles.post('/', async (c) => {
  const user = await verifyUser(c.req.raw);
  const body = await c.req.json().catch(() => null);
  if (!body?.id || !body?.title || !body?.submitterId) {
    return c.json({ error: 'id, title, and submitterId are required' }, 400);
  }
  if (!user || user.$id !== body.submitterId) return c.json({ error: 'Unauthorized' }, 401);

  // OR IGNORE rather than a targeted ON CONFLICT (id): slug is also
  // UNIQUE, and while a real collision is very unlikely (every slug
  // generator here appends a Date.now() suffix), a slug conflict should
  // degrade the same way an id conflict (retry) does -- silently skip,
  // never a hard failure on what's already a fire-and-forget shadow-write.
  await c.env.DB
    .prepare(
      `INSERT OR IGNORE INTO articles (
        id, slug, title, side_header, content, genre, category, status,
        location_district, location_area, location, image_file_id, image_caption, youtube_id,
        submitter_id, submitter_name, submitter_email, submitter_avatar, author_name, author_email,
        views, is_breaking, is_featured, is_contest_entry, tracker_data,
        submitted_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      body.id, body.slug || null, body.title, body.sideHeader || null, body.content || null,
      body.genre || null, body.category || null, body.status || 'published',
      body.locationDistrict || null, body.locationArea || null, body.location || null, body.imageFileId || null,
      body.imageCaption || null, body.youtube_id || null,
      body.submitterId, body.submitterName || null, body.submitterEmail || null, body.submitterAvatar || null,
      body.authorName || null, body.authorEmail || null,
      body.isBreaking ? 1 : 0, body.isFeatured ? 1 : 0, body.isContestEntry ? 1 : 0, body.trackerData || null,
      body.submittedAt || null, body.publishedAt || null
    )
    .run();

  if (Array.isArray(body.galleryImageIds)) {
    for (let i = 0; i < body.galleryImageIds.length; i++) {
      const fileId = body.galleryImageIds[i];
      if (!fileId) continue;
      await c.env.DB
        .prepare('INSERT INTO article_gallery_images (article_id, file_id, sort_order) VALUES (?, ?, ?)')
        .bind(body.id, fileId, i)
        .run();
    }
  }

  if (Array.isArray(body.supportingImages)) {
    for (let i = 0; i < body.supportingImages.length; i++) {
      const img = body.supportingImages[i];
      if (!img?.fileId) continue;
      await c.env.DB
        .prepare('INSERT INTO article_supporting_images (article_id, file_id, caption, sort_order) VALUES (?, ?, ?, ?)')
        .bind(body.id, img.fileId, img.caption || null, i)
        .run();
    }
  }

  return c.json({ ok: true });
});

// Whitelist of fields PATCH accepts, camelCase (as sent by the client) ->
// snake_case column. One generic endpoint covers every real edit shape
// found in the app: full content edits, single-flag toggles
// (breaking/featured/genre-region hero+pin), weekly-picks management
// (add/remove/reorder/section/lead), and the admin author-name sync
// utility -- all of them are just "update some subset of these columns,"
// differing only in which fields and which UI action triggers them.
const PATCH_FIELD_MAP: Record<string, string> = {
  title: 'title', sideHeader: 'side_header', content: 'content', genre: 'genre',
  locationDistrict: 'location_district', locationArea: 'location_area', location: 'location',
  imageFileId: 'image_file_id', imageCaption: 'image_caption', youtube_id: 'youtube_id',
  isBreaking: 'is_breaking', isFeatured: 'is_featured', isContestEntry: 'is_contest_entry',
  trackerData: 'tracker_data', status: 'status', rejectionReason: 'rejection_reason',
  submitterName: 'submitter_name',
  isWeeklyPick: 'is_weekly_pick', weeklyLive: 'weekly_live', weeklyIssue: 'weekly_issue',
  weeklySection: 'weekly_section', weeklyOrder: 'weekly_order', isWeeklyLead: 'is_weekly_lead',
  isGenreFeatured: 'is_genre_featured', isGenrePinned: 'is_genre_pinned',
  isRegionFeatured: 'is_region_featured', isRegionPinned: 'is_region_pinned',
};
const BOOL_FIELDS = new Set([
  'isBreaking', 'isFeatured', 'isContestEntry', 'isWeeklyPick', 'weeklyLive',
  'isWeeklyLead', 'isGenreFeatured', 'isGenrePinned', 'isRegionFeatured', 'isRegionPinned',
]);

// PATCH /articles/:id -- partial update. Allowed if the JWT belongs to
// the article's own submitter, or to a reporter/admin (matches
// reporter/edit/[id]/page.tsx's own ownership check, and admin/page.tsx's
// broader edit capability over any article).
articles.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await verifyUser(c.req.raw);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const row = await c.env.DB.prepare('SELECT submitter_id FROM articles WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  if ((row as any).submitter_id !== user.$id && !isReporterOrAdmin(user)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'Body required' }, 400);

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(PATCH_FIELD_MAP)) {
    if (body[key] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(BOOL_FIELDS.has(key) ? (body[key] ? 1 : 0) : body[key]);
  }
  const hasImageUpdate = Array.isArray(body.supportingImages) || Array.isArray(body.galleryImageIds);
  if (sets.length === 0 && !hasImageUpdate) return c.json({ error: 'No recognized fields in body' }, 400);

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    await c.env.DB.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run();
  }

  if (Array.isArray(body.supportingImages)) {
    await c.env.DB.prepare('DELETE FROM article_supporting_images WHERE article_id = ?').bind(id).run();
    for (let i = 0; i < body.supportingImages.length; i++) {
      const img = body.supportingImages[i];
      if (!img?.fileId) continue;
      await c.env.DB
        .prepare('INSERT INTO article_supporting_images (article_id, file_id, caption, sort_order) VALUES (?, ?, ?, ?)')
        .bind(id, img.fileId, img.caption || null, i)
        .run();
    }
  }

  if (Array.isArray(body.galleryImageIds)) {
    await c.env.DB.prepare('DELETE FROM article_gallery_images WHERE article_id = ?').bind(id).run();
    for (let i = 0; i < body.galleryImageIds.length; i++) {
      const fileId = body.galleryImageIds[i];
      if (!fileId) continue;
      await c.env.DB
        .prepare('INSERT INTO article_gallery_images (article_id, file_id, sort_order) VALUES (?, ?, ?)')
        .bind(id, fileId, i)
        .run();
    }
  }

  return c.json({ ok: true });
});

// DELETE /articles/:id -- reporter/admin only, not scoped to own
// articles (matches admin/page.tsx's handleDelete, which any reporter or
// admin can invoke on any article today).
articles.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await verifyUser(c.req.raw);
  if (!user || !isReporterOrAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);

  await c.env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});
