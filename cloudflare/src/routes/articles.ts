import { Hono } from 'hono';

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
  const where: string[] = [];
  const params: unknown[] = [];

  where.push('status = ?');
  params.push(q.status || 'published');

  if (q.district) { where.push('location_district = ?'); params.push(q.district); }
  if (q.genre) { where.push('genre = ?'); params.push(q.genre); }
  if (q.breaking) { where.push('is_breaking = 1'); }
  if (q.featured) { where.push('is_featured = 1'); }
  if (q.contest) { where.push('is_contest_entry = 1'); }
  if (q.submitterId) { where.push('submitter_id = ?'); params.push(q.submitterId); }
  if (q.ids) {
    const ids = q.ids.split(',').filter(Boolean);
    if (ids.length === 0) return c.json({ documents: [], total: 0, nextCursor: null });
    where.push(`id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }

  const whereSql = where.join(' AND ');

  const pageWhere = q.cursor ? `${whereSql} AND created_at < ?` : whereSql;
  const pageParams = q.cursor ? [...params, q.cursor] : params;

  const sql = `SELECT * FROM articles WHERE ${pageWhere} ORDER BY created_at DESC LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(...pageParams, limit).all();
  const docs = (results || []).map(toArticleJson);
  const nextCursor = docs.length === limit ? (results![results!.length - 1] as any).created_at : null;

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

  return c.json({ ...toArticleJson(row), supportingImages });
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
