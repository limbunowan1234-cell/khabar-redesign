const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.in';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

async function getArticles(limit: number): Promise<any[]> {
  try {
    const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
    const q3 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [limit] }));
    const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q1 + '&queries[]=' + q2 + '&queries[]=' + q3, {
      headers: { 'X-Appwrite-Project': PROJECT },
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export async function GET() {
  const articles = await getArticles(100);
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
      'Cache-Control': 's-maxage=600, stale-while-revalidate',
    },
  });
}
