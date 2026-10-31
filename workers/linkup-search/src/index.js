// Linkup search proxy for KhabarDarjeeling / GorkhaTV.
// Keeps LINKUP_API_KEY on the server; the browser only ever talks to this Worker.
//
//   GET /search?q=landslide+kurseong            -> web results
//   GET /search?q=tea+auction&local=1           -> biased toward Darjeeling hills
//   GET /search?q=...&depth=deep                -> slower, more thorough (costs more)

const LINKUP_URL = "https://api.linkup.so/v1/search";
const MAX_QUERY_LENGTH = 200;
const CACHE_SECONDS = 600; // identical searches within 10 min reuse the cached answer
const LOCAL_CONTEXT = "Darjeeling Kalimpong Kurseong Mirik Gorkha";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (url.pathname === "/") {
      return json({ ok: true, usage: "GET /search?q=your+query&local=1" }, 200, cors);
    }
    if (url.pathname !== "/search") {
      return json({ error: "Not found" }, 404, cors);
    }
    if (request.method !== "GET") {
      return json({ error: "Use GET" }, 405, cors);
    }
    if (!env.LINKUP_API_KEY) {
      return json({ error: "Server is missing LINKUP_API_KEY" }, 500, cors);
    }

    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return json({ error: "Missing ?q=" }, 400, cors);
    if (q.length > MAX_QUERY_LENGTH) {
      return json({ error: `Query too long (max ${MAX_QUERY_LENGTH} characters)` }, 400, cors);
    }
    const local = url.searchParams.get("local") === "1";
    const depth = url.searchParams.get("depth") === "deep" ? "deep" : "standard";

    // Cache key ignores the Origin so all sites share cached answers.
    const cacheKey = new Request(
      `https://cache.local/search?q=${encodeURIComponent(q.toLowerCase())}&local=${local}&depth=${depth}`
    );
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      return withHeaders(cached, { ...cors, "X-Cache": "HIT" });
    }

    let upstream;
    try {
      upstream = await fetch(LINKUP_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.LINKUP_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: local ? `${q} (${LOCAL_CONTEXT})` : q,
          depth,
          outputType: "searchResults",
        }),
      });
    } catch {
      return json({ error: "Could not reach Linkup" }, 502, cors);
    }

    if (!upstream.ok) {
      // Don't forward Linkup's raw error body; it can mention account details.
      const status = upstream.status === 429 ? 429 : 502;
      return json({ error: `Search failed (Linkup ${upstream.status})` }, status, cors);
    }

    const data = await upstream.json();
    const results = (data.results || []).slice(0, 10).map((r) => ({
      title: r.name,
      url: r.url,
      snippet: (r.content || "").replace(/\s+/g, " ").slice(0, 300),
    }));

    const response = json({ query: q, local, results }, 200, {
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return withHeaders(response, { ...cors, "X-Cache": "MISS" });
  },
};

// ALLOWED_ORIGINS is a comma-separated list, e.g.
// "https://khabardarjeeling.com,https://gorkhatv.com". "*" allows any site.
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin = allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (allowOrigin) headers["Access-Control-Allow-Origin"] = allowOrigin;
  return headers;
}

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function withHeaders(response, extra) {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(extra)) r.headers.set(k, v);
  return r;
}
