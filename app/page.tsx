import type { Metadata } from 'next';
import HomeClient from './HomeClient';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.space';

export const metadata: Metadata = {
  title: 'Khabar Darjeeling - The Digital Home of Darjeeling',
  description: 'Latest news from Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and the Gorkha community - politics, sports, culture, tea gardens, tourism and more.',
  alternates: { canonical: SITE },
};

function imgUrl(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  const id = a?.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return SITE + '/assets/logo.png';
  if (String(id).startsWith('http')) return id;
  return ENDPOINT + '/storage/buckets/article-image/files/' + id + '/view?project=' + PROJECT;
}

function clean(text: string, max = 160): string {
  if (!text) return '';
  const t = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).trim() + '...' : t;
}

async function fetchLatestArticles(): Promise<any[]> {
  try {
    
    const q2 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
    const q3 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [30] }));
    const res = await fetch(
      ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q2 + '&queries[]=' + q3,
      { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export default async function Page() {
  const articles = await fetchLatestArticles();

  const itemListJsonLd = articles.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: articles.slice(0, 20).map((a: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: SITE + '/article/' + (a.slug || a.$id),
      name: a.title,
    })),
  } : null;

  return (
    <>
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      )}

      {/* SEO content block - crawlable by search engines, visually hidden (content matches page purpose) */}
      <div style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }} aria-hidden="false">
        <h1>Khabar Darjeeling - Latest News from Darjeeling and the Gorkha Community</h1>
        <p>Comprehensive news coverage of Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and West Bengal - politics, sports, culture, tea gardens, tourism and more.</p>
        <h2>Latest News</h2>
        <ul>
          {articles.map((a: any) => (
            <li key={a.$id}>
              <a href={SITE + '/article/' + (a.slug || a.$id)}>
                <h3>{a.title}</h3>
              </a>
              <p>{clean(a.content || a.summary || '')}</p>
              <span>{a.category || 'News'}</span>
            </li>
          ))}
        </ul>
      </div>

      <HomeClient initialArticles={articles} />
    </>
  );
}
