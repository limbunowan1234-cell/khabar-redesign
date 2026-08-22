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

Still fully on Appwrite: comments/publishing writes, admin panel,
search/filter.

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
