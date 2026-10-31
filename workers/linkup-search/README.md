# Linkup search Worker

Cloudflare Worker that powers Darjeeling-focused web search for khabardarjeeling.in.
The Linkup API key lives only as a Cloudflare secret; browsers call this Worker instead.

Live: https://linkup-search.limbunowan1234.workers.dev

## Endpoints

- `GET /search?q=...` – web results (up to 10: title, url, snippet)
- `&local=1` – bias results toward the Darjeeling hills
- `&depth=deep` – slower, more thorough search (uses more credits)

Identical searches are cached for 10 minutes. Only origins listed in
`ALLOWED_ORIGINS` (`wrangler.toml`) can call it from a browser.

## Deploy

```bash
npm install
npx wrangler deploy
npx wrangler secret put LINKUP_API_KEY   # first time only
```

For local testing, put `LINKUP_API_KEY=...` in `.dev.vars` (git-ignored) and run `npm run dev`.

`demo/index.html` is a standalone search page wired to the live Worker.
