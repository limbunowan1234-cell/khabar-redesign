# khabar-worker — Phase 1 + 2

Read-only D1-backed API for `articles` (Phase 1), plus an R2-backed CDN
route for images and the APK (Phase 2). Everything else still lives on
Appwrite until later phases.

**Status: Week 1 (Phase 1) complete.** Real remote D1 database is live
(`khabar-d1`, `991e6a3d-1aca-4c2a-bbdf-5b8d374d45b8`) with the full schema
applied — 18 tables. All 190 articles (+ 22 supporting images) imported
from Appwrite. The Worker is deployed and public at
`https://khabar-worker.limbunowan1234.workers.dev`, confirmed serving real
data with correct pagination totals.

**Status: Phase 2 in progress.** Both R2 buckets exist
(`khabar-article-images`, `khabar-downloads`), bound into the Worker, with
a working CDN route (`/cdn/articles/:key`, `/cdn/apk/:key`) — tested
end-to-end on a real file. The bulk copy of all 287 files from Appwrite
Storage is **partway through** (paused, not failed) — resume with:

```bash
APPWRITE_API_KEY=xxx node scripts/copy-storage-to-r2.mjs
```

It's idempotent (R2 keys = Appwrite file `$id`), so re-running just
re-uploads whatever's already there and continues past it — safe to run
from the top every time rather than tracking a resume point. Once it
finishes: re-verify the AVIF image case that broke Appwrite's `/preview`
endpoint earlier this year still resolves cleanly through `/cdn/articles/`.

Nothing in the Next.js app reads from either the D1 API or the R2 CDN
yet — that's Week 2.

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
- **Nothing in the Next.js app points here yet.** All 73 files still call
  Appwrite directly (both for D1-backed data and for images/APK). Swapping
  even one read call site over is the next concrete step, once Phase 2's
  file copy is confirmed complete.
