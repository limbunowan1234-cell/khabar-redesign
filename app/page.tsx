import type { Metadata } from 'next';
import HomeClient from './HomeClient';
import { headers } from 'next/headers';
import { truncateChars } from '@/lib/textPreview';

const SITE = 'https://khabardarjeeling.in';
// Week 6 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export const metadata: Metadata = {
  title: 'Khabar Darjeeling - The Digital Home of Darjeeling',
  description: 'Latest news from Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and the Gorkha community - politics, sports, culture, tea gardens, tourism and more.',
  alternates: { canonical: SITE },
};

function clean(text: string, max = 160): string {
  if (!text) return '';
  return truncateChars(text.replace(/<[^>]*>/g, ' '), max);
}

async function fetchLatestArticles(): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?limit=30', { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export default async function Page() {
  const articles = await fetchLatestArticles();
  const ua = (await headers()).get('user-agent') || '';
  const initialIsMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);

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
      <div style={{ position: 'absolute', top: 0, left: 0, width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }} aria-hidden="false">
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

      <HomeClient initialArticles={articles} initialIsMobile={initialIsMobile} />
    </>
  );
}
