const SITE = 'https://khabardarjeeling.in';
// Week 6 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function getImageUrl(a: any): string {
  const id = a.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return WORKER_URL + '/cdn/articles/' + id;
}

async function getArticles(): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?limit=1000', { next: { revalidate: 3600 } });
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
