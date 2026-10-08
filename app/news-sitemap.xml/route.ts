const SITE = 'https://khabardarjeeling.in';
// Week 6 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Google News only considers articles from the last 48 hours.
const NEWS_WINDOW_MS = 48 * 60 * 60 * 1000;
// If nothing is that fresh, list the latest few anyway so <urlset> is never
// empty (an empty urlset is what triggers "Missing XML tag: url" in GSC).
const FALLBACK_COUNT = 10;

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Devanagari range written as escapes so this file stays pure ASCII.
const DEVANAGARI = /[\u0900-\u097F]/;

function langOf(a: any): string {
  const raw = String(a.language || a.lang || '').toLowerCase();
  if (raw.startsWith('ne') || raw === 'nepali') return 'ne';
  if (raw.startsWith('hi') || raw === 'hindi') return 'hi';
  if (raw.startsWith('en') || raw === 'english') return 'en';
  // No language field: Devanagari title -> Nepali (the site's main non-English language)
  return DEVANAGARI.test(a.title || '') ? 'ne' : 'en';
}

function dateOf(a: any): number {
  return new Date(a.publishedAt || a.$createdAt).getTime();
}

// Returns { articles, ok }. ok=false means the Worker call itself failed
// (not "genuinely zero recent articles") -- callers must not cache that
// result the same way as a real empty result.
async function getArticles(limit: number): Promise<{ articles: any[]; ok: boolean }> {
  try {
    const res = await fetch(WORKER_URL + '/articles?limit=' + limit, { next: { revalidate: 600 } });
    if (!res.ok) {
      console.error('news-sitemap: Worker returned', res.status);
      return { articles: [], ok: false };
    }
    const data = await res.json();
    return { articles: data.documents || [], ok: true };
  } catch (err) {
    console.error('news-sitemap: fetch failed:', err);
    return { articles: [], ok: false };
  }
}

export async function GET() {
  const { articles, ok } = await getArticles(100);

  const valid = articles
    .filter((a: any) => a && a.title && !Number.isNaN(dateOf(a)))
    .sort((x: any, y: any) => dateOf(y) - dateOf(x));

  const cutoff = Date.now() - NEWS_WINDOW_MS;
  const recent = valid.filter((a: any) => dateOf(a) >= cutoff);
  const chosen = recent.length > 0 ? recent : valid.slice(0, FALLBACK_COUNT);

  const items = chosen.map((a: any) => {
    // Use the slug (canonical URL, same as sitemap.xml); fall back to $id.
    const path = '/article/' + encodeURIComponent(a.slug || a.$id);
    const date = new Date(dateOf(a)).toISOString();
    return '  <url>\n' +
      '    <loc>' + esc(SITE + path) + '</loc>\n' +
      '    <news:news>\n' +
      '      <news:publication>\n' +
      '        <news:name>Khabar Darjeeling</news:name>\n' +
      '        <news:language>' + langOf(a) + '</news:language>\n' +
      '      </news:publication>\n' +
      '      <news:publication_date>' + date + '</news:publication_date>\n' +
      '      <news:title>' + esc(a.title) + '</news:title>\n' +
      '    </news:news>\n' +
      '  </url>';
  });

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    (items.length ? items.join('\n') + '\n' : '') +
    '</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Never freeze a failed Worker fetch (or an empty result) into the cache.
      'Cache-Control': ok && items.length ? 's-maxage=600, stale-while-revalidate' : 'no-store',
    },
  });
}
