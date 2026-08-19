# khabar-worker — Phase 1

Read-only D1-backed API for `articles`, plus the one write endpoint that
actually needs to move first (view counting, since it fires on every
article page load). Everything else still lives on Appwrite until later
phases.

**Status:** schema and Worker are written and verified locally (schema
executes cleanly in real SQLite, and the Worker was run end-to-end against
a local simulated D1 with real inserts/reads/updates — see the migration
plan doc for details). Nothing is deployed to real Cloudflare
infrastructure yet — that needs your login.

## One-time setup (you run these, not me — no Cloudflare credentials in
## this environment)

```bash
cd cloudflare
npm install
npx wrangler login          # opens a browser, authorizes wrangler
npm run db:create           # prints a database_id — paste it into wrangler.toml
npm run db:schema           # applies db/schema.sql to the real (remote) D1 database
```

Verify the database looks right:

```bash
npx wrangler d1 execute khabar-d1 --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Should list all 18 tables from `db/schema.sql`.

## Importing real article data

Requires the same `APPWRITE_API_KEY` already set in Vercel's environment
variables for this project (used by `lib/newsDigest.ts` etc.) — grab it
from Vercel's dashboard, don't create a new one unless you want to.

```bash
APPWRITE_API_KEY=xxx node scripts/export-appwrite.mjs
npx wrangler d1 execute khabar-d1 --file=./db/seed-articles.sql
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
- **No R2, no image serving.** Phase 2.
- **Nothing in the Next.js app points here yet.** All 73 files still call
  Appwrite directly. Swapping even one read call site over is the next
  concrete step once you've confirmed the data in D1 looks right.
