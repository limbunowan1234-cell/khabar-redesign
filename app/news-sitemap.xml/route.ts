const SITE = 'https://khabardarjeeling.in';
// Week 6 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// Returns { articles, ok }. ok=false means the Worker call itself failed
// (not "genuinely zero recent articles") -- callers must not cache that
// result the same way as a real empty result, or a single transient
// failure gets frozen into the public response for the full cache window.
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
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = articles.filter((a: any) => new Date(a.publishedAt || a.$createdAt).getTime() >= cutoff);
  const items = recent.map((a: any) => {
    const url = SITE + '/article/' + a.$id;
    const date = new Date(a.publishedAt || a.$createdAt).toISOString();
    return '  <url>\n' +
      '    <loc>' + url + '</loc>\n' +
      '    <news:news>\n' +
      '      <news:publication>\n' +
      '        <news:name>Khabar Darjeeling</news:name>\n' +
      '        <news:language>en</news:language>\n' +
      '      </news:publication>\n' +
      '      <news:publication_date>' + date + '</news:publication_date>\n' +
      '      <news:title>' + esc(a.title || '') + '</news:title>\n' +
      '    </news:news>\n' +
      '  </url>';
  }).join('\n');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    items + '\n' +
    '</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Only cache a result we know is real -- a failed Worker fetch
      // must never get frozen into the public response for 10 minutes.
      'Cache-Control': ok ? 's-maxage=600, stale-while-revalidate' : 'no-store',
    },
  });
}
