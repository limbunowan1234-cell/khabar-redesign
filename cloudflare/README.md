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

Still fully on Appwrite: everything gated by auth, search/filter results,
admin panel, profile, contest, Bhasa Diwas — each is its own future
increment.

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
