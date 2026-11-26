import { Hono } from 'hono';
import { verifyUser, isReporterOrAdmin, isSuspended, type AppUser } from '../lib/auth';
import { pushBreakingIfNew } from './deviceTokens';
import type { FcmEnv } from '../lib/fcm';
import { logModeration, PUBLISH_LIMITS } from '../lib/moderation';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string } & FcmEnv;

export const articles = new Hono<{ Bindings: Bindings }>();

// Maps a D1 row (snake_case) back to the shape Appwrite documents already
// have (camelCase + $id) so the ~73 call sites in the Next.js app can swap
// their fetch URL to this Worker without also rewriting how they read the
// response — that rewrite can happen gradually, call site by call site,
// instead of being a single all-at-once change blocking this migration.
//
// submitterEmail/authorEmail are only included when canSeeEmails(): this
// endpoint is public (homepage, sitemaps, any scraper), and including them
// unconditionally exposed every reporter's email address to anyone. No
// page in the Next.js app reads them back -- they're only written on
// submit -- so dropping them for anonymous callers breaks nothing.
function toArticleJson(row: any, includeEmails = false) {
  const json: Record<string, unknown> = {
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
    kind: row.kind || 'story',
    relatedArticleId: row.related_article_id || null,
    tags: parseTags(row.tags),
  };
  // Only present when the caller asked for stats=1 (the app's feeds).
  if (row.like_count !== undefined) json.likeCount = row.like_count;
  if (row.comment_count !== undefined) json.commentCount = row.comment_count;
  if (row.submitter_labels !== undefined) json.byStaff = isStaffLabels(row.submitter_labels);
  if (row.submitter_handle !== undefined) json.submitterHandle = row.submitter_handle || null;
  if (row.submitter_avatar_now !== undefined && row.submitter_avatar_now) json.submitterAvatar = row.submitter_avatar_now;
  if (!includeEmails) {
    delete json.submitterEmail;
    delete json.authorEmail;
  }
  return json;
}

function parseTags(raw: unknown): string[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

function isStaffLabels(raw: unknown): boolean {
  try {
    const labels = JSON.parse(String(raw || '[]')) as string[];
    return labels.includes('admin') || labels.includes('reporter');
  } catch {
    return false;
  }
}

// Up to 8 short tags, trimmed, lower-cased, de-duplicated.
function cleanTags(input: unknown): string | null {
  if (!Array.isArray(input)) return null;
  const tags = Array.from(
    new Set(input.filter((t) => typeof t === 'string').map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))
  ).slice(0, 8);
  return tags.length ? JSON.stringify(tags) : null;
}

// Extra columns for stats=1: like and comment counts, whether the author
// is staff (for the "Community" label), their @handle and current avatar.
const STATS_SELECT = `,
  (SELECT COUNT(*) FROM likes l WHERE l.article_id = articles.id AND l.comment_id IS NULL) AS like_count,
  (SELECT COUNT(*) FROM comments cm WHERE cm.article_id = articles.id) AS comment_count,
  (SELECT u.labels FROM users u WHERE u.id = articles.submitter_id) AS submitter_labels,
  (SELECT p.handle FROM profiles p WHERE p.user_id = articles.submitter_id) AS submitter_handle,
  (SELECT p.avatar_url FROM profiles p WHERE p.user_id = articles.submitter_id) AS submitter_avatar_now`;

// Reporters/admins see every article's emails; anyone else only their own.
function canSeeEmails(user: AppUser | null, row: any): boolean {
  if (!user) return false;
  return isReporterOrAdmin(user) || row.submitter_id === user.$id;
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

  // Verified once up front -- used both for the status=all gate below and
  // for deciding whether each row may include email fields.
  const user = await verifyUser(c.req.raw, c.env);

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
    if (user && user.$id === q.submitterId) {
      // no status filter at all -- every status for this one author
    } else {
      where.push('status = ?');
      params.push('published');
    }
  } else if (q.status === 'all') {
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

  // Comma-separated accepts multiple districts (app/daily-updates -- "other
  // districts" combines 4 in one query) while staying a plain equality for
  // every existing single-value caller (region/[name], curate).
  if (q.district) {
    const districts = q.district.split(',').filter(Boolean);
    where.push(`location_district IN (${districts.map(() => '?').join(',')})`);
    params.push(...districts);
  }
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
  // Flash News lives in the same table. Existing feeds (website home,
  // sitemaps, region/genre pages) keep getting stories only; Flash News
  // shows up when asked for (kind=flash), and kind=all returns both. Id
  // lookups (bookmarks) and staff/author dashboards (status=all) see every
  // kind unless they say otherwise.
  const kind = q.kind || (q.ids || q.status === 'all' ? 'all' : 'story');
  if (kind === 'story' || kind === 'flash') { where.push('kind = ?'); params.push(kind); }
  if (q.tag) { where.push("tags LIKE ?"); params.push('%"' + q.tag.toLowerCase().replace(/[%_"]/g, '') + '"%'); }
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

  const sql = `SELECT *${q.stats === '1' ? STATS_SELECT : ''} FROM articles WHERE ${pageWhere} ORDER BY ${sortSql} LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql).bind(...pageParams, limit).all();
  const docs = (results || []).map((r: any) => toArticleJson(r, canSeeEmails(user, r)));
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

  const extra = c.req.query('stats') === '1' ? STATS_SELECT : '';
  let row = await c.env.DB.prepare(`SELECT *${extra} FROM articles WHERE id = ?`).bind(idOrSlug).first();
  if (!row) {
    row = await c.env.DB.prepare(`SELECT *${extra} FROM articles WHERE slug = ?`).bind(idOrSlug).first();
  }
  if (!row) return c.json({ error: 'Not found' }, 404);

  // Same rule as the list endpoint: only published articles are public.
  // Pending/rejected/draft rows are visible to their submitter and to
  // reporters/admins (edit pages, dashboard previews); everyone else gets
  // the same 404 as a missing id, so drafts can't be probed for existence.
  if ((row as any).status !== 'published') {
    const user = await verifyUser(c.req.raw, c.env);
    if (!user || ((row as any).submitter_id !== user.$id && !isReporterOrAdmin(user))) {
      return c.json({ error: 'Not found' }, 404);
    }
  }

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

  const user = await verifyUser(c.req.raw, c.env);
  return c.json({ ...toArticleJson(row, canSeeEmails(user, row)), supportingImages, galleryImageIds });
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

// --- Primary writes as of Week 34 (see cloudflare/README.md) ---
// Appwrite's articles collection is frozen; these three (POST, PATCH
// /:id, DELETE) are the sole write path now, not a shadow-write copy.

// POST /articles -- creates a new article. `id` is generated client-side
// (crypto.randomUUID(), since Week 34 -- Appwrite no longer generates it)
// and passed through so later edits/deletes can address the same row.
// JWT must belong to the exact submitterId in the body -- matches the
// real app's current access model (app/post/page.tsx lets any logged-in
// user create an article, not just reporters/admins; the reporter/admin
// UI's own tighter gating is enforced client-side only, not something
// this migration should silently invent).
articles.post('/', async (c) => {
  const user = await verifyUser(c.req.raw, c.env);
  const body = await c.req.json().catch(() => null);
  if (!body?.id || !body?.title || !body?.submitterId) {
    return c.json({ error: 'id, title, and submitterId are required' }, 400);
  }
  if (!user || user.$id !== body.submitterId) return c.json({ error: 'Unauthorized' }, 401);

  // Open publishing, but with staff-only powers. Anyone logged in can post,
  // yet only reporters/admins may mark a story breaking (which pushes a
  // notification to every app user) or featured, publish it as "rejected",
  // or credit it to someone else. For everyone else the byline is always
  // their own account, so nobody can post under another person's name.
  const staff = isReporterOrAdmin(user);
  if (!staff && (await isSuspended(c.env.DB, user.$id))) {
    return c.json({ error: 'Your account can no longer publish. Contact nowanad@gmail.com.' }, 403);
  }
  const kind = body.kind === 'flash' ? 'flash' : 'story';
  if (kind === 'flash' && !body.imageFileId) return c.json({ error: 'Flash News needs a photo.' }, 400);
  if (kind === 'flash' && String(body.content || '').length > 600) {
    return c.json({ error: 'Keep the Flash News description under 600 characters.' }, 400);
  }

  if (!staff) {
    // Publishing needs a confirmed email address (reading, liking and
    // commenting don't). Accounts that existed before 1.4.0 count as
    // confirmed.
    const acct = await c.env.DB
      .prepare('SELECT email_verified, created_at FROM users WHERE id = ?')
      .bind(user.$id)
      .first<{ email_verified: number; created_at: string }>();
    if (!acct?.email_verified) {
      return c.json({ error: 'Please confirm your email address before publishing.', code: 'EMAIL_NOT_VERIFIED' }, 403);
    }
    // Daily limits, lower for brand-new accounts (lib/moderation.ts).
    const isDraft = body.status === 'draft';
    if (!isDraft) {
      const firstDay = Date.now() - new Date(acct.created_at.replace(' ', 'T') + 'Z').getTime() < 86400_000;
      const limit = firstDay ? PUBLISH_LIMITS[kind].firstDay : PUBLISH_LIMITS[kind].perDay;
      const recent = await c.env.DB
        .prepare("SELECT COUNT(*) AS n FROM articles WHERE submitter_id = ? AND kind = ? AND status <> 'draft' AND created_at > datetime('now', '-1 day')")
        .bind(user.$id, kind)
        .first<{ n: number }>();
      if ((recent?.n || 0) >= limit) {
        const what = kind === 'flash' ? 'Flash News posts' : 'stories';
        return c.json({ error: `You can publish up to ${limit} ${what} a day. Please try again tomorrow.`, code: 'RATE_LIMITED' }, 429);
      }
    }
  }

  const OPEN_STATUSES = ['published', 'draft', 'pending_review'];
  const status = staff ? body.status || 'published' : OPEN_STATUSES.includes(body.status) ? body.status : 'published';
  const isBreaking = staff && !!body.isBreaking;
  const isFeatured = staff && !!body.isFeatured;
  const submitterName = staff ? body.submitterName || user.name : user.name;
  const submitterEmail = staff ? body.submitterEmail || user.email : user.email;
  const authorName = staff ? body.authorName || user.name : user.name;
  const authorEmail = staff ? body.authorEmail || user.email : user.email;

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
        submitted_at, published_at, kind, related_article_id, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      body.id, body.slug || null, body.title, body.sideHeader || null, body.content || null,
      body.genre || null, body.category || null, status,
      body.locationDistrict || null, body.locationArea || null, body.location || null, body.imageFileId || null,
      body.imageCaption || null, body.youtube_id || null,
      body.submitterId, submitterName || null, submitterEmail || null, body.submitterAvatar || null,
      authorName || null, authorEmail || null,
      isBreaking ? 1 : 0, isFeatured ? 1 : 0, body.isContestEntry ? 1 : 0, body.trackerData || null,
      body.submittedAt || null, status === 'published' ? body.publishedAt || new Date().toISOString() : body.publishedAt || null,
      kind, body.relatedArticleId || null, cleanTags(body.tags)
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

  // Breaking-news push to the Android app (see routes/deviceTokens.ts).
  // Background, so a slow/failed push never delays or fails the save.
  if (isBreaking) c.executionCtx.waitUntil(pushBreakingIfNew(c.env, body.id));

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
  relatedArticleId: 'related_article_id', publishedAt: 'published_at',
};
// Fields only reporters/admins may change. An author editing their own
// story can fix its text, photos and place, but can't make it breaking
// (that sends a push to every phone), feature it, pick it for the weekly
// edition or change who it's credited to.
const STAFF_ONLY_FIELDS = new Set([
  'isBreaking', 'isFeatured', 'isWeeklyPick', 'weeklyLive', 'weeklyIssue', 'weeklySection',
  'weeklyOrder', 'isWeeklyLead', 'isGenreFeatured', 'isGenrePinned', 'isRegionFeatured',
  'isRegionPinned', 'rejectionReason', 'submitterName',
]);
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
  const user = await verifyUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const row = await c.env.DB.prepare('SELECT submitter_id FROM articles WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const staff = isReporterOrAdmin(user);
  if ((row as any).submitter_id !== user.$id && !staff) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  if (!staff && (await isSuspended(c.env.DB, user.$id))) {
    return c.json({ error: 'Your account can no longer publish. Contact nowanad@gmail.com.' }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'Body required' }, 400);
  if (!staff) {
    for (const key of STAFF_ONLY_FIELDS) delete body[key];
    // Authors can publish, unpublish to a draft or send for review, never
    // set any other status (e.g. un-reject their own rejected story).
    if (body.status !== undefined && !['published', 'draft', 'pending_review'].includes(body.status)) delete body.status;
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(PATCH_FIELD_MAP)) {
    if (body[key] === undefined) continue;
    sets.push(`${column} = ?`);
    params.push(BOOL_FIELDS.has(key) ? (body[key] ? 1 : 0) : body[key]);
  }
  if (body.tags !== undefined) { sets.push('tags = ?'); params.push(cleanTags(body.tags)); }
  const hasImageUpdate = Array.isArray(body.supportingImages) || Array.isArray(body.galleryImageIds);
  if (sets.length === 0 && !hasImageUpdate) return c.json({ error: 'No recognized fields in body' }, 400);

  if (staff && (row as any).submitter_id !== user.$id && body.status !== undefined) {
    const action = body.status === 'published' ? 'republish' : 'unpublish';
    c.executionCtx.waitUntil(logModeration(c.env.DB, user, action, 'article', id, body.rejectionReason || null));
  }

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

  // Breaking-news push: fires when this write could have made the article
  // published + breaking (the admin "Breaking" toggle, or approving an
  // article already marked breaking). pushBreakingIfNew re-reads the row
  // and only ever sends once per article.
  if (body.isBreaking || body.status === 'published') {
    c.executionCtx.waitUntil(pushBreakingIfNew(c.env, id));
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

// DELETE /articles/:id -- the story's own author, or any reporter/admin
// (admin/page.tsx's handleDelete). Open publishing means people need to be
// able to take down what they posted themselves.
articles.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await verifyUser(c.req.raw, c.env);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const owner = await c.env.DB.prepare('SELECT submitter_id, title FROM articles WHERE id = ?').bind(id).first<{ submitter_id: string; title: string }>();
  if (!owner) return c.json({ ok: true });
  if (owner.submitter_id !== user.$id) {
    if (!isReporterOrAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);
    await logModeration(c.env.DB, user, 'delete', 'article', id, owner.title);
  }

  await c.env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});
