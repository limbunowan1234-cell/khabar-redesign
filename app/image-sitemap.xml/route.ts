const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.space';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function getImageUrl(a: any): string {
  const id = a.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return ENDPOINT + '/storage/buckets/article-image/files/' + id + '/view?project=' + PROJECT;
}

async function getArticles(): Promise<any[]> {
  try {
    const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
    const q3 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [1000] }));
    const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q1 + '&queries[]=' + q2 + '&queries[]=' + q3, {
      headers: { 'X-Appwrite-Project': PROJECT },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export async function GET() {
  const articles = await getArticles();

  const items = articles.map((a: any) => {
    const url = SITE + '/article/' + (a.slug || a.$id);
    const date = new Date(a.$updatedAt || a.publishedAt || a.$createdAt || Date.now()).toISOString();
    const imgUrl = getImageUrl(a);

    let imageBlock = '';
    if (imgUrl) {
      imageBlock = '\n    <image:image>\n' +
        '      <image:loc>' + esc(imgUrl) + '</image:loc>\n' +
        '      <image:title>' + esc(a.title || '') + '</image:title>\n' +
        '    </image:image>';
    }

    return '  <url>\n' +
      '    <loc>' + esc(url) + '</loc>\n' +
      '    <lastmod>' + date + '</lastmod>' +
      imageBlock + '\n' +
      '  </url>';
  }).join('\n');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    items + '\n' +
    '</urlset>';

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
