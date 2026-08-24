# khabar-worker — Phase 1 + 2

Read-only D1-backed API for `articles` (Phase 1), plus an R2-backed CDN
route for article images (Phase 2). Everything else still lives on
Appwrite until later phases.

**Status: Week 1 (Phase 1) complete.** Real remote D1 database is live
(`khabar-d1`, `991e6a3d-1aca-4c2a-bbdf-5b8d374d45b8`) with the full schema
applied — 18 tables. All 190 articles (+ 22 supporting images) imported
from Appwrite. The Worker is deployed and public at
`https://khabar-worker.limbunowan1234.workers.dev`, confirmed serving real
data with correct pagination totals.

**Status: Phase 2 (images) complete.** The `khabar-article-images` R2
bucket exists, bound into the Worker, with a working CDN route
(`/cdn/articles/:key`) — tested end-to-end on a real file, then all 285
article images copied over and confirmed reachable through it.

**Permanent exclusion: the APK.** `app-downloads` (2 files) is staying on
Appwrite for good — explicit decision, not a deferral. No bandwidth
pressure from 2 files, not worth the extra bucket/route/script surface.
`khabar-downloads` R2 bucket was created, then deleted once this was
decided; nothing in the app changes — `HomeClient.tsx`'s `APK_URL` keeps
pointing at Appwrite permanently.

**Status: Week 2 (homepage cutover) done.** The homepage
(`app/HomeClient.tsx` and everything it renders by default —
`MagazineHero`, `LatestSection`, `DistrictSection`, `GenreColumns`,
`HillsInFrameWidget`) now reads articles from the Worker and images from
the R2 CDN instead of Appwrite. Verified in a real browser: correct
article count and content, all images loading through `/cdn/articles/`
with zero broken images, article detail pages (still Appwrite, untouched)
unaffected. `HillsInFrameWidget`'s own data (`photography` collection)
is still Appwrite — only its images moved, since they live in the same
bucket already copied to R2.

**Status: Week 3 (article detail pages) done.** `app/article/[id]/page.tsx`
and `ArticleClient.tsx` read the article body, related articles (by
genre), the author's other articles (by submitterId), and every image on
the page from the Worker/R2. View counting is live for real —
`PATCH /articles/:id/views` fires on every article page load, the first
write endpoint actually in production use. Likes, bookmarks, follows and
comments stay on Appwrite (writes gated by auth, waiting on the
auth-bridging phase).

**Status: Week 4 (genre/region pages) done.** `app/genre/[name]/page.tsx`
and `app/region/[name]/page.tsx` read from `GET /articles` (`?genre=` /
`?district=`) plus the R2 CDN for images. Added
`isGenreFeatured`/`isGenrePinned`/`isRegionFeatured`/`isRegionPinned` to
the Worker's article JSON — both pages need them for hero/pinned
curation and they weren't exposed yet, even though the D1 columns
existed. Also fixed a pre-existing bug in both pages' image-URL
functions (missing the `'Text'` sentinel-value guard other components
already have) while already in there.

**Status: Week 5 (weekly digest + shared image-proxy) done.**
`app/api/image-proxy/route.ts` — shared by the Daily Updates poster,
weekly digest, and Bhasa Diwas gallery for canvas-safe cross-origin image
loading — now proxies `article-image` bucket requests through R2. A
second Appwrite bucket (Bhasa Diwas submissions) shares this same route
via `?bucket=`; that one correctly stays on Appwrite, not migrated yet.
`app/weekly/page.tsx` + `WeeklyClient.tsx` fetch from the Worker,
filtering client-side for `weeklyLive`/`isWeeklyPick`. Admin-preview auth
check stays on Appwrite.

**Status: Week 6 (SEO infrastructure) done.** `app/page.tsx`'s SSR fetch
(hidden SEO block + JSON-LD, rendered before `HomeClient` hydrates) now
reads from the Worker — this was a gap left over from Week 2, where only
the client-side fetch got swapped. `sitemap.ts`, `rss.xml`,
`news-sitemap.xml`, `image-sitemap.xml` all read from the Worker too;
`image-sitemap.xml`'s image URLs point at the R2 CDN. List limit bumped
500 → 1000 for the two sitemap routes that want everything in one call.

**Status: Week 7 (shared components) done.** `TopCreators.tsx` fully
migrated. `AuthorBadge.tsx`, `TierProgress.tsx`, `lib/certRanking.ts`
partially — the articles read (via `?submitterId=`/`?contest=`) comes
from the Worker; likes/comments stay on Appwrite since those collections
aren't in D1 yet. These are shared across many pages, so this benefits
several call sites (every article page, profile pages, contest results)
from one change.

**Status: Week 8 (remaining collections, read-only) done.** Exported and
imported `likes` (1,137), `comments` (382), `follows` (109), `bookmarks`
(45), `profiles` (157) into D1 — real data had a meaningful duplicate
rate (~18.5% on likes) from a pre-existing race condition in the app's
toggle functions; the export script dedupes rather than corrupting the
import. Five new read-only routes: `/likes`, `/comments`, `/follows`,
`/bookmarks`, `/profiles/:userId`, plus `?ids=` on `/articles` for bulk
lookup. Wired into `AuthorBadge`, `TierProgress`, `certRanking`,
`app/bookmarks/page.tsx`, and both profile pages.

**Explicitly not migrated: "my articles" on the own-profile page.** It
needs to show the owner's own pending/rejected/draft work, which requires
real per-user authorization — this Worker has none yet. A `status=all`
override was drafted, then reverted before shipping once it was clear
that meant *any* caller could read *any* user's unpublished articles.
Stays on Appwrite until auth-bridging exists.

**Status: Week 9 (auth-bridging, read-only) done.** The Worker can now
verify who's asking. `cloudflare/src/lib/auth.ts`'s `verifyUser()` takes
an `Authorization: Bearer <jwt>` header, hands it to Appwrite
server-to-server (`X-Appwrite-JWT`) to confirm it's real. The client side
(`lib/appwrite.ts`'s `getWorkerAuthToken()`) mints that JWT via Appwrite's
own `POST /account/jwts`, using the session cookie that already exists —
no session cookie or password ever touches the Worker's domain.

`GET /articles?status=all` now requires a verified JWT matching the exact
`submitterId` requested; anyone else silently gets published-only.
`app/profile/page.tsx`'s "my articles" (deferred in Week 8 for this exact
reason) uses it now. Verified the negative path directly (no auth header,
fake JWT — both correctly blocked); the positive path needs a real login
to confirm end-to-end, still untested live.

**Still deliberately read-only.** Writes (likes, comments, follows,
bookmarks, publishing) all stay on Appwrite — moving those needs the
shadow-write validation phase from the migration plan first, so a
permission bug shows up in a diff, not in production data.

**Status: Week 10 (contest page, shared read helpers) done.**
`app/contest/page.tsx` + `ContestClient.tsx` (results with vote/comment
scoring, discussion thread) read from the Worker. Fixed `/comments`
ordering (was oldest-first, every caller expects newest-first) at the
Worker level rather than in each caller. `lib/appwrite.ts`'s shared
`getArticleLikes`/`getUserBookmarks`/`getCommentLikes` now read from the
Worker too — used by `ArticleClient.tsx`, `HillsInFrameSwipeClient.tsx`,
and `ContestClient.tsx`, so this benefits several call sites at once.
Removed six confirmed-unused exports from the same file while there.

**Status: Week 11 (Nepali Bhasa Diwas) done.** New `votes` column on
`bhasa_diwas_submissions` + new `bhasa_diwas_votes` table, real data
exported (23 submissions, 131 votes). New Worker routes
(`/bhasa-diwas/submissions`, `/bhasa-diwas/votes`). All four read paths —
submissions feed, leaderboard, discussion comments (which reuse the
existing `comments` table, no new work needed), and the SSR detail page —
migrated. Voting/commenting/submitting stay on Appwrite.

**Permanent exclusion: this feature's images.** Its own bucket (separate
Appwrite bucket id, 3 files, 5.1MB) stays on Appwrite for good — same
kind of call as the APK exclusion, not a deferral. R2 bucket *creation*
was failing account-side at the time ("Please enable R2 through the
Cloudflare Dashboard", even though existing R2 buckets kept working
fine), and with only 3 files there's no real bandwidth case for chasing
it down. The existing image-proxy fallback already handles this bucket
correctly since it only special-cases `article-image`.

**Status: Week 12 (shadow-write validation begins) done.** The first
real write path off Appwrite: `toggleArticleLike`/`toggleCommentLike`
(`lib/appwrite.ts`) now also mirror into D1 via `POST`/`DELETE /likes`
on the Worker, fire-and-forget, after the real Appwrite write succeeds.
Appwrite stays the sole source of truth — nothing reads from or depends
on D1 for likes yet.

Both write endpoints require a verified JWT for the exact `userId` being
written, same boundary as the `status=all` read check. Found and fixed a
real gap before shipping: the schema's table-level
`UNIQUE(article_id, comment_id, user_id)` doesn't actually stop duplicate
article-level likes (SQL treats every NULL `comment_id` as distinct) —
added two partial unique indexes and verified the insert is idempotent
directly against real D1.

`cloudflare/scripts/diff-likes.mjs` compares Appwrite against D1 for the
whole collection — run it periodically during the validation window.
Baseline: 1137/1137 match, zero drift.

**Not yet tested:** the actual toggle flow through a real logged-in
browser session (needs live login). The auth-rejection paths and insert
idempotency were both verified directly against real infrastructure.

**Status: Week 13 (shadow-write validation, bookmarks) done.**
`toggleBookmark` shadow-writes into D1 the same way, same auth boundary.
Simpler than likes — `UNIQUE(user_id, article_id)` has no nullable
column, so the plain constraint just works. Caught that
`app/bookmarks/page.tsx` has its own separate remove-bookmark
implementation that bypasses the shared helper — gave it its own
shadow-write call so this write path wasn't silently missed.
`cloudflare/scripts/diff-bookmarks.mjs`, same shape as likes'. Baseline:
45/45, zero drift.

**Status: Week 14 (shadow-write validation, follows) done.** Third write
path, JWT-gated to `followerId`. Found the shared `toggleFollow` in
`lib/appwrite.ts` was dead code — the real (only) follow/unfollow call
site is `ProfileClient.tsx`'s own local implementation, which never used
it. Removed the unused export, gave the real one its own shadow-write.
`cloudflare/scripts/diff-follows.mjs`. Baseline: 109/109, zero drift.

**Status: Week 15 (shadow-write validation, comments) done.** Fourth
write path, and the last of the "simple toggle" batch — except comments
aren't a toggle. No `UNIQUE` constraint (a user can post the same text
twice on purpose), so it's a plain idempotent create/delete rather than
an `ON CONFLICT` toggle. D1's row `id` has to be Appwrite's real `$id`
rather than a fresh UUID, since deleting later needs both systems to
agree on the identifier — `POST /comments` takes `id` from the caller
instead of generating one.

Comments also have a real authorization nuance: article comments allow
the author *or* an admin to delete; contest discussion comments only
allow the author. Added an `isAdmin()` check to the Worker's
`DELETE /comments/:id` that mirrors the client-side `ADMIN_EMAIL`/
`labels.includes('admin')` check exactly, so both behaviors are enforced
server-side regardless of which client calls it.

No shared helper this time — `ArticleClient.tsx`, `ContestClient.tsx`,
and `HillsInFrameSwipeClient.tsx` each have their own local post/delete
logic, so all three needed separate shadow-write wiring. Also fixed two
stale reads found along the way: `ArticleClient.tsx`'s `fetchComments`
and `HillsInFrameSwipeClient.tsx`'s `loadComments` were still hitting
Appwrite directly despite earlier notes suggesting they'd already moved.
Removed the dead `postComment` export from `lib/appwrite.ts` (confirmed
via grep — nothing imports it, every real caller has its own
implementation).

**Deliberately excluded:** the Bhasa Diwas comments API route posts
server-side with the admin API key, not a per-user JWT — incompatible
with the JWT-based shadow-write mechanism as built. Left out of scope
for this pass, not silently worked around.

`cloudflare/scripts/diff-comments.mjs` compares by `id` (Appwrite's real
`$id`) rather than a natural key. Baseline: 383 Appwrite (with a
`userId`) vs 382 D1, one row only in Appwrite — expected drift from real
site activity between the Week 8 export and shadow-writes starting, not
a bug.

All four "simple toggle"/create-delete write paths now shadow-write
(likes, bookmarks, follows, comments). Still fully on Appwrite:
publishing/editing, admin panel, search/filter, Bhasa Diwas
voting/submitting.

**Status: Week 16 (contest_settings) done.** A different-shaped write
path than the last four: `contest_settings` (`certificatesLive`,
`pinnedCommentId`) is admin-only and single-row, and its two writers —
`app/api/admin/contest/pin-comment` and `publish-certificates` — are
Next.js API routes calling Appwrite with the service API key, not a
browser session.

Looked like the same architectural mismatch that excluded the Bhasa
Diwas comments route, but wasn't: both admin routes already receive a
real per-admin JWT (`x-admin-jwt` header) and verify it against Appwrite
themselves before ever touching the API key — the key only sidesteps
`contest_settings/main`'s empty `$permissions` on the Appwrite write
itself. That JWT hands straight to the Worker's existing `verifyUser()`,
so both routes now shadow-write into D1 through a new admin-gated
`POST /contest/settings`, same fire-and-forget pattern as everywhere
else. Extracted `isAdmin()` out of `comments.ts` into `lib/auth.ts` as a
shared export rather than defining it a third time.

**Real drift caught before wiring any reads.** D1's `contest_settings`
row was still the Week 1 schema-seed default (`certificates_live=0`,
`pinned_comment_id=NULL`) — this table predates Week 8's export and had
never been synced. Real Appwrite had certificates live and a comment
pinned. Reading the stale row first would have been a real regression
(the site would report certificates as not yet published), not a
no-op — corrected the D1 row to match before flipping any client read
over.

With D1 corrected and both writers shadow-writing, wired the three read
call sites — `app/admin/page.tsx`, `ContestClient.tsx`,
`app/profile/page.tsx` — from their own direct Appwrite fetches to
`GET /contest/settings` on the Worker.

Verified: auth boundary (no token / fake token, both 401 — admin-gated,
not userId-matched). The single-row `UPDATE` is inherently idempotent —
verified twice against real D1, then restored to the real value.

Remaining scope, still none started: publishing/editing articles, admin
approve/reject/curate flows (needs a broader admin-role check extension
than this one table), Bhasa Diwas voting/submitting, certificate
downloads, notifications, profile editing.

**Status: Week 17 (pivot to read-side-first) done.** Strategy change:
finish exposing the remaining collections from D1 before moving more
writes over, so every export gets validated before anything depends on
it, rather than continuing write-path-by-write-path.

Before starting new reads, checked something that had never been
checked: `articles` is the one D1 table that's been "migrated" since
Week 1 but nothing has ever kept in sync — every article write
(publish, edit, approve/reject, curate flags, weekly picks) still lands
on Appwrite only, with no shadow-write safety net like likes/comments/
etc. have had since Week 12+. Added `cloudflare/scripts/diff-articles.mjs`
and ran it against all 190 articles: zero drift on status, title, or any
curation flag. The site turned out fine, but nothing was checking that
until now, and this table still has no shadow-write, so it can drift
again — worth re-running this periodically.

New read path: `certificate_state` (download count + rank on the
contest certificate page). New `GET /certificates?userId=` route on the
Worker; `app/profile/page.tsx`'s downloadCount now reads from D1.
Read-only, matching the new strategy — the docId lookup and the actual
download-count write both stay on Appwrite for now, so D1 can lag by
however many downloads happen before the next export. Low-stakes: worst
case someone re-downloads their own certificate PNG past the 3-download
cap.

Exporting turned up the identical non-atomic get-or-create race already
known from Week 8's likes/follows/bookmarks: some users had multiple
`certificate_state` rows instead of one (13 raw documents, 9 unique
users). Deduped by keeping the max `downloadCount` per user — the
conservative choice, since undercounting would let someone exceed the
cap.

**Status: Week 18 (notifications) done.** Private per-user data (a
user's own activity feed and unread count), so the new
`GET /notifications?userId=` route is JWT-gated the same way
`GET /articles?status=all` is — the caller must present a verified JWT
for the exact userId requested, or a 401, never someone else's
notifications.

Exported and imported 422 notifications into D1 for the first time —
extended `export-appwrite.mjs` with an `exportNotifications()` function
matching the existing per-collection pattern. Re-ran the full export
while at it; confirmed the regenerated seed files for already-migrated
collections (likes, comments, follows, bookmarks, profiles, bhasa-diwas)
are gitignored scratch output, not re-imported — D1 already holds
validated, shadow-written data for those that's more current than a
fresh snapshot would be.

Wired the two real read call sites — `NotificationBell.tsx`'s unread
count and dropdown list, and `app/profile/page.tsx`'s recent-activity
feed — from their own direct Appwrite fetches to the Worker, reusing
`getWorkerAuthToken()` (profile's page already mints one for the
my-articles fetch on the same load).

Read-only, matching the current plan: marking a notification read,
mark-all-read, and creating one in the first place (the
send-notification admin route) all still write to Appwrite only —
documented explicitly, same posture as the Bhasa Diwas comments
exclusion.

New `cloudflare/scripts/diff-notifications.mjs`, same shape as
`diff-comments.mjs` plus a read-state drift check. Baseline: 422/422
match exactly, including read state.

**Status: Week 19 (admin dashboard + curate page article reads) done.**
`app/admin/page.tsx`'s dashboard needs every status across every author,
not just one person's own — the existing Week 9
`status=all&submitterId=` only covers a user's own drafts. Added a
second shape to `GET /articles`: `status=all` with no `submitterId`,
gated by a new `isReporterOrAdmin()` check in `lib/auth.ts` (broader
than `isAdmin()` — reporters manage articles too without being full
admins). No verified reporter/admin JWT silently falls back to
published-only, same non-leaking pattern as the existing check.

Caught a real response-shape gap while wiring this up: `toArticleJson()`
was missing two fields the admin edit flow actually reads from the list
response — `trackerData` (populates the tracker-embed form when
editing) and `rejectionReason`. Both columns already existed in D1's
schema, just never exposed. Added them.

`app/admin/curate/page.tsx` (setting hero/pinned flags for genre and
region pages) turned out not to need any of this — it only ever curates
published content, so it now just reads the existing public
`GET /articles?genre=`/`?district=` route with no auth, rather than
replicating the unrestricted-status query it had before. That old query
didn't correspond to any real draft/pending workflow anyway — every
article is created with `status: 'published'` directly — so this
changes nothing observable today and is more correct going forward.

Verified: the new `status=all` branch's auth boundary (no token, fake
token) falls back to published-only as expected. The positive path
needs a live login to confirm end-to-end, same open item as Week 9's
original check.

**Status: Week 20 (analytics_events) done.** Different shape than the
rest of this read-first pass: `analytics_events` is a live,
high-frequency event stream (every page view), not stable reference
data. Reading it from a one-time D1 snapshot would show meaningless
numbers within minutes, so this one got read+write together this week
rather than deferred — same reasoning as Week 16's `contest_settings`.

Turned out simpler than the JWT-gated writes: the existing write path
(`app/api/analytics/track/route.ts`) is already public and
unauthenticated on the Appwrite side — most readers aren't logged in,
so there was never a user session to check. The new
`POST /analytics/events` on the Worker needs no auth either, same trust
level as `PATCH /articles/:id/views`.

`recordEvent()` previously always generated its own Appwrite document id
internally. Changed it to accept an optional id and return the one
used, so the track route generates one UUID shared by both the real
Appwrite write and the D1 shadow-write — gives the shadow-write real
idempotency (`ON CONFLICT DO NOTHING`) via a retry-safe shared id, same
pattern `comments.ts` uses for the same reason.

`app/api/admin/analytics/route.ts` (already JWT-gated to admin) now
reads events from the Worker instead of Appwrite; its article-fetch
helper switched to the existing public `/articles` route as a free win.
Removed the now-dead `fetchEventsSince` export from
`lib/analyticsEvents.ts`.

Verified: `POST` is idempotent against real D1 (retry with the same id
produced no duplicate row), `GET` returns what was written, test row
cleaned up afterward.

Deliberately out of scope: D1 retention. Appwrite's `analytics_events`
gets pruned to a 30-day rolling window by a Vercel cron gated by
`CRON_SECRET`; D1 has no equivalent yet, since that would need
`CRON_SECRET` provisioned as a Worker secret and that value isn't
available in this session. Low-severity — D1 storage accumulating
unbounded for a while doesn't block anything — but documented rather
than silently skipped.

**Status: Week 21 (news_digest) done.** Same shape as Week 16's
`contest_settings` and Week 20's `analytics_events`: a single-row
admin-only cache, so read+write moved together rather than deferred —
reading a stale/empty row would be a real regression for the one admin
who uses this, not a harmless lag.

`news_digest` predates this migration and was never exported. Confirmed
via grep it has exactly one real consumer path —
`app/admin/news-digest/page.tsx` through
`app/api/admin/news-digest/{route,refresh/route}.ts`, both already
admin-JWT-gated. Backfilled D1 from the real current Appwrite row first
(new `cloudflare/scripts/seed-news-digest.mjs`) so the read never shows
stale/empty data even before the first shadow-write lands — same
precaution as Week 16.

New `GET`/`POST /news-digest` on the Worker, admin-gated the same way
`contest_settings` is. Both Next.js routes reuse the incoming
`x-admin-jwt` for the Worker call. `GET` reads from D1 when a real
admin JWT is present; the cron-secret path (`NEWS_DIGEST_CRON_SECRET`,
no per-admin JWT to reuse) keeps reading Appwrite directly.

Deliberately out of scope, documented rather than silently skipped: the
cron-triggered write path has no JWT either, so it doesn't
shadow-write — same class of gap as Week 20's analytics retention cron.

Verified: auth boundary (no token, fake token, both 401). Seeded D1 row
matches Appwrite exactly (3381-char sectionsJson, same
lastVerified/updatedAt).

**Status: Week 22 (article create/edit/delete shadow-writes) done.**
Articles are the highest-value data in this migration, so this got more
scrutiny than any write path so far — every auth boundary, idempotency
check, and cascade-delete verified directly against real D1 before
touching a single client call site.

Scoped first with a full inventory: 11 distinct write shapes across 6
files (create ×4, full edit ×2, single-flag toggles ×6, weekly-picks
management ×5 shapes, delete, bulk author-name sync). Rather than 11
endpoints, collapsed everything except create and delete into one
generic `PATCH /articles/:id` that updates only whichever whitelisted
fields are present in the body — full edits, every flag toggle, and
curate's hero/pin management are really the same operation, differing
only in which UI action triggers them.

New on the Worker:
- `POST /articles` — create. `id` is the real Appwrite `$id`, passed
  through after the real create succeeds (same reasoning as
  `comments.ts`). JWT must match the body's `submitterId` — matches the
  app's real access model exactly (`app/post/page.tsx` lets any
  logged-in user create an article, not just reporters/admins;
  tightening that here would invent a restriction the real app doesn't
  have).
- `PATCH /articles/:id` — generic partial update. Allowed if the JWT
  belongs to the article's own submitter, or to a reporter/admin
  (matches `reporter/edit/[id]`'s own ownership check).
- `DELETE /articles/:id` — reporter/admin only, not ownership-scoped
  (matches `admin/page.tsx`'s current `handleDelete`).

Wired every real call site: reporter/post, the public contributor path
(`app/post/page.tsx`), admin's publish/photo-story/edit/
toggle-featured/toggle-breaking/delete, reporter/edit, and curate's
hero/pin toggles.

Documented gap: the photo-story creation path's `location` and
`galleryImageIds` fields aren't tracked in D1's articles schema (it
predates this migration). The shadow-write omits them — a photo story's
gallery images specifically won't reflect in D1 yet.

Deferred, not bundled into this already-large change: weekly-picks
add/remove/reorder/section/lead management, the cron-triggered weekly
publish, and the bulk author-name sync utility — each its own distinct
write shape.

Verified directly against real D1: auth boundary on all three endpoints
(401 without a valid token); create's idempotent insert (retry produced
`changes: 0`); cascade delete of `article_supporting_images` when the
parent article is deleted. Could not verify the full authenticated
POST/PATCH flow end-to-end — no real login or user-scoped JWT available
in this session (attempted minting one via the admin API's
`Users.createJWT`; not permitted for this API key) — same open item as
Weeks 9, 19, and 20.

Also removed `app/post/page.tsx.bak`, a stale unrouted duplicate found
while working in this file (confirmed dead — `.bak` isn't a valid
Next.js route extension, untouched since July).

**Status: Week 23 (photo-story fields, weekly-picks, edge cases)
done.** Three follow-ups to Week 22.

Added `location` (TEXT) and a new `article_gallery_images` child table
(same shape as `article_supporting_images`, no caption) to D1, live-
migrated on the remote database and added to `schema.sql` for future
fresh imports. Checked before backfilling: zero existing photo-story
articles in Appwrite, and of the 124 articles with a non-null legacy
`location` field, all 124 already have `locationArea` set too — which
always wins in the app's own fallback — so no backfill was actually
needed, only forward support. `toArticleJson()` now includes
`location`; the single-article read now also returns `galleryImageIds`.
Both `POST` and `PATCH` accept and store both fields — Week 22's
photo-story shadow-write was already sending them, it just had nothing
on the Worker side to receive them.

All 5 remaining weekly-picks write shapes from Week 22's inventory
(add/remove pick, reorder, rename section, set lead story) needed zero
new Worker code — the generic `PATCH /articles/:id` already whitelists
every weekly field. Just wired shadow-writes into the 5 admin functions
that call it. The two cron-triggered weekly-publish paths stay
Appwrite-only — both run server-side with the admin API key and a
`CRON_SECRET`, no per-admin JWT to reuse, same excluded shape as the
analytics and news-digest crons.

Edge cases found and fixed:
- `PATCH /articles/:id` incorrectly rejected a body containing only
  image-array updates and no column fields — fixed so the two run
  independently.
- `POST /articles` switched from a targeted `ON CONFLICT (id)` to
  `INSERT OR IGNORE`, so a genuine slug collision degrades the same way
  an id retry does (silently skipped) instead of throwing.
- Investigated whether article deletion should cascade-clean D1
  likes/comments/bookmarks — confirmed real Appwrite deletes don't do
  this either, and `comments.article_id` deliberately holds non-article
  pseudo-ids for contest/Bhasa Diwas discussions, so a real foreign key
  there would break that feature — left as-is to match existing
  behavior exactly.

Verified directly against real D1: `GET` returns `location`/
`galleryImageIds` correctly for a seeded test article; cascade delete
of gallery images on article delete; `INSERT OR IGNORE` silently skips
a real slug collision instead of throwing.

Not in this pass: the bulk author-name sync utility — its own distinct
write shape, left for a future increment.

**Status: Week 24 (go-live pass: cut remaining reads over to D1)
done.** "Go live" was ambiguous, so asked first rather than guessing —
it scoped down to: cut reads over fully for anything already
shadow-written and diff-verified; writes stay dual for now (still
Appwrite + shadow-write). Cutting writes over too would have been
genuinely risky — several write paths were never end-to-end tested
with a real login this whole migration.

Audited every remaining direct-Appwrite fetch across ~21 files first.
Found 7 genuine cutover candidates and, just as importantly, 4 that
must *not* move: `certificate_state`'s docId lookup and three `follows`
docId lookups (`ArticleClient.tsx`, `ProfileClient.tsx` ×2) — all four
exist solely to feed a subsequent Appwrite write by Appwrite's own
document id, which D1 doesn't have (D1's rows use their own generated
ids, decoupled from Appwrite's). Cutting those over would have broken
the write that follows them.

Cut over: `HomeClient.tsx`'s home-district profile lookup (→
`GET /profiles/:userId`), `ArticleClient.tsx`'s `checkFollowing`
boolean check (→ `GET /follows`), admin's edit-content fallback fetch
and reporter's edit-form load (→ `GET /articles/:id`), and the reporter
dashboard's own-articles list (→
`GET /articles?status=all&submitterId=`, JWT-gated the same way the
profile page's "my articles" already is).

Two needed real Worker work first: `GET /articles` didn't support
filtering on `weeklyLive`/`isWeeklyPick`, or any sort besides
`created_at desc`. Added both, plus a whitelisted `SORT_MAP` never
built from raw query input (keeps `ORDER BY` injection-proof).

Caught a real latent bug while adding the weekly-issue sort:
`weekly_issue` is stored as TEXT in D1 (matches Appwrite's own
numeric-string values), so a naive DESC sort would put `"10"` before
`"2"` once issue numbers hit double digits — dormant today (the site's
only at issue 7) but this sort didn't exist against D1 before today, so
it would have shipped broken. Fixed with `CAST(weekly_issue AS
INTEGER) DESC`. Also fixed the admin next-issue-number code: against
Appwrite, `weeklyIssue + 1` worked because it was a real number there;
against D1 it comes back as a string, so unguarded this would have
silently produced `"71"` instead of `8`. Added an explicit `Number()`
coercion.

Verified: both new filter combinations cross-checked against live
Appwrite counts (0 pending weekly picks in both — exact match). Loaded
the homepage and an article page in a real browser afterward: both
render correctly, no new console errors, no regressions on the
(anonymous, most-trafficked) path. The reads that only fire for a
logged-in user couldn't be exercised without a real login — same open
item as every previous JWT-gated verification this migration.

**Status: Weeks 25–26 (write cutover: likes and bookmarks together)
done.** The write-cutover phase begins. Every write path since Week 12
has been dual — real Appwrite write plus a best-effort D1 shadow-write,
Appwrite authoritative. These are the first two actually flipped:
`toggleArticleLike`/`toggleCommentLike` and `toggleBookmark` in
`lib/appwrite.ts` now write to D1 through the Worker only. Appwrite's
`likes` and `bookmarks` collections are both frozen as of this pair of
commits — nothing writes to either again.

Picked these two to go first deliberately: lowest stakes of everything
shadow-written (losing a like or a bookmark is inconsequential, unlike
an article or a comment), the two most mature write paths (12+ weeks of
clean diffs each, likes the very first one ever built), and the read
side has trusted D1 exclusively for both since Week 8 — so this cutover
is really just deleting the Appwrite calls, not changing what anything
displays.

Mechanically the same shape for both: mint a JWT (already existed for
the shadow-writes), check current state via a `GET` that's already
scoped correctly server-side, then `POST`/`DELETE` against the Worker
directly. Removed both shadow-write helpers — neither is a shadow
anymore, each is the only write. Bookmarks needed a second call site:
`app/bookmarks/page.tsx`'s own separate remove implementation, the same
one Week 13 found bypassing the shared helper.

Found a real bug while touching that second call site: that page's
bookmark list has read from the Worker/D1 since Week 8, so the bookmark
objects it held used D1's own generated id, not Appwrite's real
document id. Its Appwrite `DELETE` call used that id anyway — which
never matched a real Appwrite document, so that delete had been
silently no-op'ing (404, never thrown) since Week 8. Only the D1
shadow-delete (Week 13, keyed by `userId`+`articleId`, not id) was ever
actually removing anything from that page. Moot now — the broken call
is gone entirely, replaced by the same direct D1 delete the working
shadow-write already used. Removed the now-unused `DB` constant this
left behind, and checked whether the bug had left orphaned data: it
hadn't (45/45 at the cutover baseline).

Updated `diff-likes.mjs` and `diff-bookmarks.mjs`: "only in Appwrite"
should now stay flat forever for both (real drift if it grows), while
"only in D1" becomes the expected, growing bucket for everything that
happens from here on — not a bug signal like it is for every other
collection these scripts' shape is copied from. Cutover-moment
baselines: likes 1137/1137, bookmarks 45/45, all four only-in counts at
0.

Verified: typecheck and full production build clean for both. Loaded
an article page in a real browser after the likes cutover — renders
correctly, no errors traceable to either change (one unrelated
pre-existing 500 on `/api/analytics/track`, caused by
`APPWRITE_API_KEY` missing from local `.env.local`). Could not test an
actual like/unlike or bookmark/unbookmark end-to-end for either — needs
a real logged-in session, same open item as every write path this
migration.

**Status: Week 27 (third write cutover — follows) done.** Same pattern
as Weeks 25–26: follow/unfollow now writes to D1 through the Worker
only. Appwrite's `follows` collection is frozen as of this commit.

Two call sites — the same two Week 24 correctly declined to cut over,
since they needed Appwrite's own document id for a subsequent Appwrite
delete, which D1 can't supply. That constraint disappears once the
delete itself targets D1 instead: `ArticleClient.tsx`'s `handleFollow`
and `ProfileClient.tsx`'s `toggleFollow` both now delete by
`followerId`+`followingId` directly, no id lookup needed at all.

`ProfileClient.tsx`'s `toggleFollow` simplified further: it no longer
needs a pre-delete `GET` to find "existing docs" (the old code even
looped to delete multiple, since Appwrite's collection had no real
uniqueness constraint) — D1 enforces `UNIQUE(follower_id,
following_id)`, and the component already knows `isFollowing` from
state, so the toggle just acts on that directly. Removed the
`shadowWriteFollow` helper — no longer a shadow, it's the only write.

Corrected a stale comment in `ProfileClient.tsx` claiming it held "the
only real follow/unfollow call site in the app" — it didn't;
`ArticleClient.tsx` has always had its own separate one, cut over here
too. Removed a now-dead `DB` constant left behind.

Updated `diff-follows.mjs`'s framing the same way as likes/bookmarks.
Cutover-moment baseline: 109/109, both only-in counts at 0.

Verified: typecheck and full production build clean. Could not test an
actual follow/unfollow end-to-end — needs a real logged-in session,
same open item as every write path this migration.

**Status: Week 28 (fourth write cutover — comments) done.** One step
up in complexity from the last three: three real client call sites
(`ArticleClient.tsx`, `ContestClient.tsx`,
`HillsInFrameSwipeClient.tsx`) instead of one or two. All now write to
D1 through the Worker only. Comments aren't a toggle, so the shape
differs from likes/bookmarks/follows: the old code relied on Appwrite
generating the real document id, captured it, then reused it for the
shadow-write. With Appwrite out of the loop, the client now generates
its own id upfront (`crypto.randomUUID()`). Checked all three callers
first — none use `createComment`'s return value (they always re-fetch
the list afterward), so no need to reconstruct a full comment object.

Found a more serious gap while working through the third file:
`HillsInFrameSwipeClient.tsx` had its own completely separate `likes`
implementation for Hills in Frame photos, never migrated at all — still
hitting Appwrite directly for both reads and writes, missed entirely by
Week 25's likes cutover because it never used the shared helper. Week
25's "Appwrite's likes collection is frozen" claim was actually wrong
for this one feature. Switched it to the shared
`toggleArticleLike`/`getArticleLikes` helpers, now D1-only like
everything else — and improved on the original along the way, since it
now reverts its optimistic UI update if the write fails, which neither
backend's version ever did.

Removed now-fully-dead Appwrite REST constants from all three files —
comments were the last thing still using them for a database write in
two of the three; `ContestClient.tsx` still needs its auth-check
constants, unrelated to this migration.

Diff script framing needed a different note this time: unlike the last
three, the Bhasa Diwas comments POST route is a deliberate, ongoing
exclusion (server-side, admin API key, no per-user JWT) never
shadow-written and untouched by this cutover. "Only in Appwrite" will
keep growing from new Bhasa Diwas comments specifically — expected, not
drift. Cutover-moment baseline: 383 vs 382, the same single
pre-existing gap documented since Week 15.

Verified: typecheck and full production build clean. Loaded an article
page in a real browser — renders correctly, no errors traceable to this
change. Could not test an actual comment post/delete or the Hills in
Frame like fix end-to-end — needs a real logged-in session, same open
item as every write path this migration.

**Status: Week 29 (fifth write cutover — contest_settings) done.**
First cutover of an already-both-directions collection: `contest_settings`
has had real read+write on D1 since Week 16, unlike likes/bookmarks/
follows/comments where the read side had already been on D1 for weeks
before their writes existed at all. Cutting over here just means
removing the still-live Appwrite write from the two admin routes — the
reads (admin dashboard, `ContestClient`, profile page) were already
pointed at D1 and don't change.

Both `pin-comment` and `publish-certificates` routes now write to D1
only, through the same Worker endpoint they were already shadow-writing
to. Removed the `node-appwrite` client, the update-then-create
fallback, and `pin-comment`'s attribute-creation dance entirely — that
last one existed purely to work around Appwrite silently rejecting
writes to an attribute that didn't exist yet on that collection, moot
with Appwrite out of the write path.

Verified before freezing: pulled the real Appwrite document one more
time and confirmed it matches D1 exactly (`certificatesLive: true`, the
same pinned comment id on both) — safe to stop writing to Appwrite,
nothing would be lost. Re-verified the Worker's auth boundary (no token
/ fake token, both 401) since this endpoint is now the sole write
target rather than a shadow that could fail silently.

Verified: typecheck and full production build clean.

**Status: Week 30 (sixth write cutover — news_digest) done.** Same
shape as Week 29, one real surprise. Both admin routes now read and
write D1 only, through the Worker endpoint they were already
shadow-writing to. Dropped the cron-secret fallback path entirely —
grepped for it first: not in `vercel.json`'s crons array, no other
caller anywhere. Dead capability, not a real path needing a
replacement auth mechanism. Deleted `lib/newsDigest.ts` entirely —
nothing called its two exports once both routes stopped using them.

The pre-freeze check caught something real this time. Same
verification that passed cleanly for `contest_settings` in Week 29
found D1 was stale here: Appwrite's `news_digest` had been updated
today, but D1 still held Week 21's original backfill. The admin had
refreshed the digest for real through the actual admin UI at some
point in between, and the shadow-write meant to mirror that into D1
had silently never landed — fire-and-forget shadow-writes swallow
their own errors by design, and there was no dedicated diff script for
this single-row collection to catch it, unlike likes/comments/follows/
bookmarks. Re-synced from the live Appwrite document before cutting
anything over — freezing first would have permanently lost real
content.

Root cause of the original shadow-write failure not determined —
fire-and-forget swallows the actual error, and there's no server log
access in this session to dig further. Worth remembering as a concrete
example of why "a shadow-write exists" isn't the same guarantee as "the
shadow-write is working," especially for low-traffic, rarely-diffed
collections — worth the same live-data check before cutting over
`certificate_state` and `analytics_events` next.

Verified: Worker auth boundary re-checked (no token / fake token, both
401). Typecheck and full production build clean.

**Status: Week 31 (seventh write cutover — certificate_state) done.**
Different from Weeks 29–30: certificate_state's write side was never
shadow-written at all, only the read (download count, Week 17). Built
the write path fresh rather than just flipping an existing one.

New `POST /certificates` on the Worker, JWT-gated to the exact userId.
Unlike the old Appwrite version — which needed a docId lookup to decide
PATCH-vs-POST, the exact get-or-create race that produced Week 17's
duplicate-row bug in the first place — this is one upsert keyed on the
real `UNIQUE(user_id)` constraint D1 already enforces. No docId, no
race, verified directly against real D1 (two upserts with different
counts land in the same row, not two rows).

Applied the Week 30 lesson before touching anything: checked live
Appwrite against D1 first rather than assuming the Week 17 snapshot was
still current. It wasn't — a new user had downloaded a certificate
three times today, entirely absent from D1. Expected this time though,
not a shadow-write failure: Week 17 explicitly documented the write
side as still Appwrite-only, so nothing was ever supposed to be keeping
D1 in sync. Synced the missing row before cutting anything over — 16
raw Appwrite rows now (up from 13), still deduping to the same 9 users
at their same counts, plus the one new one.

`app/profile/page.tsx`'s certificate status and download handler both
simplified — no more docId field on `certState` at all, no more
Appwrite queries to find one. Removed the now-fully-dead `HJ`/`DB`
constants this left behind.

Verified: Worker auth boundary (one transient 404 on first check, gone
on retry — known edge-propagation flakiness, not a real issue). Upsert
idempotency confirmed directly against real D1. Typecheck and full
production build clean. Could not test an actual certificate download
end-to-end — needs a real logged-in session, same open item as every
write path this migration.

**Status: Week 32 (eighth write cutover — analytics_events, plus a
real production fix) done.** Not a routine cutover — found via
Vercel's runtime error logs that analytics tracking has been
completely broken in production since at least 2026-08-17. The
Appwrite service API key is missing the `collections.write` scope, so
every attempt to auto-create the `analytics_events` collection has
failed (58 errors / 48 users in just the last 24h checked). Worse,
because the old track route awaited the Appwrite write before firing
the D1 shadow-write, that failure was silently blocking the
shadow-write too — D1 had zero rows this whole time despite Week 20's
shadow-write existing since. The entire admin analytics dashboard has
been showing zero real data since deployment.

`app/api/analytics/track/route.ts` no longer touches Appwrite at all —
writes to D1 only, through the same Worker endpoint. No data existed
anywhere to lose (the Appwrite collection literally doesn't exist), so
this is the cleanest cutover of the eight so far.

Found and fixed a second, related failure while tracing this: the
daily `analytics_events` retention job — piggybacked onto the real,
Vercel-cron-triggered `/api/revalidate-sitemaps` route, since Vercel's
Hobby plan caps cron jobs at 2 — was calling the same broken
`ensureCollection()` path and had also been silently failing every
day, isolated in its own try/catch so it never took sitemap
revalidation down with it — just quietly deleted nothing, forever.

Replaced both with a single fix: 30-day retention now runs as a native
Cloudflare Cron Trigger (`wrangler.toml`'s new `[triggers]` block, a
`scheduled()` handler added to the Worker's default export) instead of
an HTTP route. This sidesteps the whole problem class outright — no
shared secret to provision, no Vercel cron slot to compete for, since
it's not an HTTP request at all. This is the fix for the gap Week 20
explicitly left open ("D1 has no retention yet — would need
`CRON_SECRET` provisioned as a Worker secret, not available in this
session") — turned out the real fix didn't need that secret at all.

Deleted the now-fully-dead `app/api/admin/analytics/cleanup/route.ts`
(a manually-triggered duplicate of the same broken Appwrite cleanup,
never itself registered as a real cron) and `lib/analyticsEvents.ts`
entirely (`recordEvent`, `deleteEventsOlderThan`, `ensureCollection` —
no callers left anywhere once the above three files stopped using
them).

Verified: deployed and confirmed the cron trigger registered
(`schedule: 0 1 * * *`). Tested the Worker's write/read cycle directly
end-to-end against real D1 — works correctly, test row cleaned up
after. Typecheck and full production build clean (after clearing a
stale `.next/` cache that referenced the deleted cleanup route and was
tripping an unrelated WASM/SWC build-worker crash on retry).

**Status: Week 33 (a real bug, found by finally testing live) done.**
Before considering the articles write cutover — the highest-stakes one
— asked for real admin credentials to test create/edit/delete through
an actual live browser session, since no write path this whole
migration had ever been exercised end-to-end, only verified via curl.
That gap turned out to be hiding a real bug curl-only testing
structurally could not have found.

Found live: the user created a real test article via the admin panel,
and Manage showed zero articles despite the create having actually
succeeded correctly (confirmed directly against Appwrite and D1 — both
had it, matching). Traced it to `GET /articles?status=all` with no
other filter — exactly `app/admin/page.tsx`'s dashboard call shape —
leaving the `where` clause completely empty for a verified
reporter/admin JWT (the one branch that intentionally applies no
status filter). Produced `WHERE  ORDER BY ...` — invalid SQL, a 500 on
every real admin dashboard load. The negative path (no/fake token)
never hit this, since it always falls back to `status = 'published'`,
keeping the clause non-empty — exactly why this was invisible to every
curl-based check this migration has done.

Reproduced the exact SQL error directly against real D1, fixed by
seeding the where-clause builder with an always-true sentinel.
Verified three ways: the reproduced error is gone running the same SQL
directly; the user refreshed after redeploy and Manage showed the
article correctly; the user then deleted it through the real UI and
both Appwrite and D1 dropped from 191 back to 190 — confirming create
and delete both actually work correctly end-to-end. The bug was in
this one read path, not in the writes themselves.

**Status: Week 34 (ninth write cutover — articles) done.** The big
one, done in one pass. Every article write across all 5 files that
touch the articles collection now writes to D1 through the Worker
only. Appwrite's articles collection is frozen — the highest-value
data in this migration, and the last major collection left
dual-writing.

Cut over, by file: `reporter/post` and public `post` (create, now
generating the article id client-side instead of capturing Appwrite's
real `$id` from a response that no longer happens); `reporter/edit`
(own-article edit); `admin/page.tsx` (publish, photo-story create,
full edit, flag toggles, delete, and all 6 weekly-picks functions —
consolidated the file's two shadow-write helpers into primary
`writeArticle`/`editArticle` functions, throwing on failure now
instead of swallowing it, shared by all 12 call sites instead of each
carrying its own duplicated pair); `admin/curate` (hero/pin toggles,
same consolidation).

Why this was safe to do in one pass: Week 33 already confirmed create
and delete work correctly end-to-end through a real logged-in session
— the one thing every prior write cutover this migration lacked — and
found + fixed the one real bug anywhere in this path. Edit wasn't
separately live-tested, but every edit call site here routes through
the same two consolidated helpers already exercised by Week 22's
direct Worker-level verification, and shares no code with the bug that
was found and fixed.

Deliberately not touched: the two cron-triggered weekly-publish
routes — documented exclusion since Week 23, no per-admin JWT
available to a cron job. Updated `diff-articles.mjs`'s framing: all
four drift counts should now stay at zero, with one expected
exception — real, weekly-fields-only drift right after those two cron
routes fire, since they're the one write path still landing on
Appwrite only. Also noted but not touched: `app/daily-updates/page.tsx`
reads articles directly from Appwrite across 4 query shapes — a
genuinely separate, never-done read migration, unrelated to this
write cutover.

Verified: typecheck and full production build clean. Cutover-moment
baseline (`diff-articles.mjs`): 190/190, zero drift on status, title,
and every curation flag — the test article from Week 33's live
verification left no trace behind.

**Status: Week 35 (close the cron-write gap) done.** Week 34 left one
loose end: the two cron-triggered weekly-publish routes, documented
back in Week 23 as an exclusion since a cron job has no per-admin JWT
to authenticate against the Worker with. They were still writing
`weeklyLive` to Appwrite every Sunday — the one write path left
touching a collection that was otherwise fully frozen.

Closed it the same way Week 32 closed the equivalent gap for
analytics_events retention: a native Cloudflare Cron Trigger
(`cloudflare/wrangler.toml`'s `[triggers]`, branching in
`scheduled()` on `event.cron`) needs no HTTP auth boundary at all,
since it's not an HTTP request — sidesteps the JWT problem instead of
solving it.

Found something while doing this: `app/api/publish-weekly/route.ts`
(weekly Vercel cron, `0 0 * * 0`) and a Sunday-only branch inside
`app/api/revalidate-sitemaps/route.ts` (daily Vercel cron) were both
independently running the exact same "publish pending weekly picks"
write, on the same schedule. Looked for any caller that needed them
to stay separate — none found (the admin's manual "publish now"
button already went through the Worker directly, per Week 34). Rather
than reimplementing that duplication against D1, consolidated into
one: a single new Worker cron trigger, `0 0 * * SUN` (Cloudflare's
day-of-week runs 1=Sunday..7=Saturday, not 0-6 — `SUN` sidesteps the
ambiguity), doing one `UPDATE articles SET weekly_live = 1 WHERE
is_weekly_pick = 1 AND weekly_live = 0`. Deleted
`app/api/publish-weekly/route.ts` and its `vercel.json` cron entry
entirely; `revalidate-sitemaps` now only revalidates sitemaps.

Also fixed a stale comment in `cloudflare/src/routes/articles.ts` —
the POST/PATCH/DELETE section header still said "shadow-write only,
Appwrite stays authoritative," left over from before Week 34 made
them the primary write path. Updated `diff-articles.mjs`'s framing to
match: the one expected-drift exception it carried (the two cron
routes) no longer applies — all four counts should now stay at zero
with no exceptions.

Verified: SQL confirmed valid against real D1 directly (`SELECT
COUNT(*) ... WHERE is_weekly_pick = 1 AND weekly_live = 0` — 0
pending at deploy time, nothing live to test the `UPDATE` branch
against, but the query shape is identical and the columns exist).
Worker typecheck clean, deployed, both triggers confirmed registered
(`wrangler deploy` output lists `schedule: 0 1 * * *` and `schedule: 0
0 * * SUN`). Next.js typecheck clean after clearing a stale `.next`
cache that still referenced the deleted route (same class of issue
seen in Week 32).

**Every article write is now fully on D1 — including the one cron
path that had been quietly left on Appwrite.** Appwrite's articles
collection can be considered completely frozen.

## One-time setup

```bash
cd cloudflare
npm install
npx wrangler login          # opens a browser, authorizes wrangler
npm run db:create           # prints a database_id — paste it into wrangler.toml
npm run db:schema:remote    # applies db/schema.sql to the real database
```

> **Gotcha that actually bit us:** `wrangler d1 execute` defaults to a
> **local** simulated database unless you pass `--remote` — it's silent
> about it too, no error, just quietly operates on a different database
> than you think. Every command that should touch the real thing uses
> `:remote` in its script name here specifically so that's never
> ambiguous again. If a script name doesn't say `:remote`, assume it's
> local-only.

Verify the database looks right:

```bash
npx wrangler d1 execute khabar-d1 --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Should list all 18 tables from `db/schema.sql`. (Confirmed working — 43 queries, 18 tables, done in ~12ms.)

## Importing real article data

Done for Week 1 — all 190 articles + 22 supporting images are in the real
D1 database. To re-run (e.g. to refresh with newer Appwrite data before
Week 2's read cutover):

```bash
APPWRITE_API_KEY=xxx node scripts/export-appwrite.mjs
npx wrangler d1 execute khabar-d1 --remote --file=./db/seed-articles.sql
```

That's articles only, matching this phase's scope. The export script is
written to extend to the other 16 collections — do that once this phase
is validated, not before.

## Running it locally

```bash
npm run dev
```

Starts the Worker on `http://localhost:8787` against a **local, simulated**
D1 (not the real one) unless you pass `--remote`. Try:

```bash
curl http://localhost:8787/articles
curl http://localhost:8787/articles/<some-slug-or-id>
```

## Deploying

```bash
npm run deploy
```

This does **not** touch the Next.js app on Vercel — it stands up the
Worker at its own `*.workers.dev` URL (or a custom domain you attach
later). Nothing in the live site reads from it until a future phase
explicitly points a fetch call here instead of Appwrite.

## What's deliberately not done yet

- **No writes except view-count.** Publishing, editing, comments, likes —
  all still go through Appwrite. Wiring those up is a Worker-side task,
  not a schema one; the tables already exist.
- **No auth verification in the Worker.** Every route here is public
  reads. The first write endpoint that needs to know *who's* asking
  (anything gated today by Appwrite's `$permissions`) is where the
  Appwrite session-check bridge described in the migration plan needs to
  get built — deliberately deferred until a write path actually needs it,
  rather than building it speculatively.
- **Only the homepage's default view has been swapped.** The other ~70
  Appwrite call sites (article detail pages, search/filter results,
  weekly digest, admin, profile, contest, etc.) are untouched. Each is
  its own future increment, same pattern as this one.
