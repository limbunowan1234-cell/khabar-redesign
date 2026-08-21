const SITE = 'https://khabardarjeeling.in';
// Week 6 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function clean(text: string, max = 300): string {
  if (!text) return '';
  const t = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).trim() + '...' : t;
}

async function getArticles(limit: number): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?limit=' + limit, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export async function GET() {
  const articles = await getArticles(50);
  const items = articles.map((a: any) => {
    const url = SITE + '/article/' + a.$id;
    const date = new Date(a.publishedAt || a.$createdAt).toUTCString();
    return '    <item>\n' +
      '      <title>' + esc(a.title || '') + '</title>\n' +
      '      <link>' + url + '</link>\n' +
      '      <guid isPermaLink="true">' + url + '</guid>\n' +
      '      <pubDate>' + date + '</pubDate>\n' +
      '      <category>' + esc(a.category || 'News') + '</category>\n' +
      '      <description>' + esc(clean(a.content || a.summary || '')) + '</description>\n' +
      '    </item>';
  }).join('\n');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0">\n' +
    '  <channel>\n' +
    '    <title>Khabar Darjeeling</title>\n' +
    '    <link>' + SITE + '</link>\n' +
    '    <description>Latest news from Darjeeling and the Gorkha community.</description>\n' +
    '    <language>en</language>\n' +
    '    <lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n' +
    items + '\n' +
    '  </channel>\n' +
    '</rss>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=900, stale-while-revalidate',
    },
  });
}
