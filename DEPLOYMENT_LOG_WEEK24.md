# Week 24 Deployment Log

**Date:** 2026-08-24
**Time:** 15:38 IST
**Deployer:** Claude Code

## Corrections to the original deployment ticket

Two premises in the ticket that requested this log didn't match the
actual repo, so the steps below are what was actually done instead of
what was literally asked:

- There is no `week-24-read-cutover` branch. All of Week 24's work was
  already committed and pushed directly to `main` in the prior session
  (commits `4b99834` and `ea482e7`). Nothing to merge.
- The Cloudflare Worker does **not** auto-deploy on push to `main` —
  there's no GitHub Actions workflow for it in this repo. Every Worker
  deploy this whole migration has been a manual `npx wrangler deploy`
  from `cloudflare/`, run by hand as part of each week's work (and
  redeployed again here to confirm currency).
- The verification endpoint in the ticket (`/api/articles?limit=1`)
  doesn't exist — the Worker has no `/api` prefix. Used
  `/articles?limit=1` instead, which is the real route.

## Changes Deployed (Week 24)

- 7 read cutovers: home-district profile lookup, `checkFollowing`
  boolean check, two edit-form content loads, reporter dashboard's
  own-articles list, and two admin weekly-picks queries.
- 2 new Worker filters (`weeklyLive`, `isWeeklyPick`) plus a
  whitelisted `sort` param on `GET /articles`.
- Bug fixes: `weekly_issue` DESC sort now casts to integer (was
  sorting as text, which breaks past issue 9); the admin
  next-issue-number calculation now coerces `weeklyIssue` to a number
  before incrementing (D1 returns it as a string; unguarded this would
  have produced `"71"` instead of `8`).

## Verification

- **Vercel deployment:** confirmed via the Vercel API, not assumed.
  Project `khabar-redesign` is GitHub-linked; the deployment for commit
  `ea482e7` (Week 24's README-status commit) is `state: READY`,
  `target: production`.
- **Worker deployment:** redeployed manually (`wrangler deploy`,
  version `270851e8-d5f1-489f-a732-74c8ee5c0be8`) to guarantee it
  matches the latest committed `articles.ts`, then confirmed live with
  `GET /articles?limit=1` → 190 total, real article data returned.
- **Diff baselines**, run against real Appwrite + D1:

  | Collection | Appwrite | D1 | Drift |
  |---|---|---|---|
  | articles | 190 | 190 | 0 |
  | likes | 1137 | 1137 | 0 |
  | comments | 383 | 382 | 1 (pre-existing gap, known since Week 15 — not new) |
  | follows | 109 | 109 | 0 |
  | bookmarks | 45 | 45 | 0 |

- **Browser test (homepage):** loaded in a real browser, real article
  data and images rendered, no console errors traceable to Week 24's
  changes.
- **Browser test (article page):** loaded correctly, no console errors
  traceable to Week 24's changes. (One pre-existing, unrelated
  hydration warning on a WhatsApp share link — not introduced by this
  deploy.)
- **Not verified:** the reads that only fire for a logged-in user
  (district prompt, `checkFollowing`, reporter dashboard, weekly-picks
  admin UI) — no real login session was available in this session to
  exercise them end-to-end. Same open item as every previous
  JWT-gated verification this migration.

## Monitoring

- Watch: Vercel function logs and Cloudflare Worker logs for new
  errors over the next 24–48 hours.
- Watch: D1 query performance (no load testing was done here).
- Diff scripts: worth re-running periodically, particularly
  `diff-articles.mjs` and `diff-comments.mjs` (comments has zero
  shadow-write safety net for the Bhasa Diwas path, and articles is
  the highest-value table with no automated re-check).

## Cost

**No savings yet, and none claimed here.** Appwrite's plan has not
been downgraded or cancelled — auth stays on Appwrite permanently by
design, and several write paths (bulk author-name sync, push
subscriptions/FCM tokens, the weekly-publish cron, Bhasa Diwas
comments) are still Appwrite-only with no shadow-write at all. Cutting
today's reads over to D1 reduces Appwrite *request volume* for those
paths, but that doesn't reduce a flat-tier bill by itself — actual
savings only materialize once Appwrite is actually downgraded or
cancelled, which hasn't happened and depends on the write-cutover work
that hasn't started yet.

## Rollback

If issues arise on the Next.js side: `git revert HEAD && git push
origin main` (Vercel will auto-deploy the revert).

If the issue is Worker-side: there's no auto-deploy to revert via git
alone — redeploy the previous Worker version manually
(`npx wrangler rollback` from `cloudflare/`, or `wrangler deploy` after
`git checkout` to the prior commit for `cloudflare/src/`).
