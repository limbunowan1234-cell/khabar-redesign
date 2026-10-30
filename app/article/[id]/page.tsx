import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArticleClient from './ArticleClient';
import { stripMarkdown } from '@/lib/textPreview';

const SITE = 'https://khabardarjeeling.in';
// Week 3 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function imgUrl(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  const id = a?.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return SITE + '/assets/logo.png';
  if (String(id).startsWith('http')) return id;
  return WORKER_URL + '/cdn/articles/' + id;
}

// Meta descriptions: up to ~155 chars, cut at a word boundary so Google
// doesn't show a half word ("...and res...").
function clean(text: string, max = 155): string {
  if (!text) return 'Latest news from Darjeeling and the Gorkha community.';
  const t = stripMarkdown(text.replace(/<[^>]*>/g, ' '));
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-]+$/, '') + '...';
}

export const revalidate = 300;

// Empty list: nothing prebuilt at deploy time, but each article is cached the
// first time it's requested instead of being rendered on every visit.
export async function generateStaticParams() {
  return [];
}

async function fetchList(query: string): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?' + query, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

// Same genre first, then same district, so links stay on-topic. Rendered on
// the server so the links are in the HTML Google crawls, not only added
// after the page loads in the browser.
async function fetchRelated(a: any): Promise<any[]> {
  const [byGenre, byDistrict] = await Promise.all([
    a.genre ? fetchList('genre=' + encodeURIComponent(a.genre) + '&limit=7') : Promise.resolve([]),
    a.locationDistrict ? fetchList('district=' + encodeURIComponent(a.locationDistrict) + '&limit=7') : Promise.resolve([]),
  ]);
  const seen = new Set<string>([a.$id]);
  const out: any[] = [];
  for (const r of [...byGenre, ...byDistrict]) {
    if (!r?.$id || seen.has(r.$id)) continue;
    seen.add(r.$id);
    out.push(r);
    if (out.length === 6) break;
  }
  return out;
}

// null only when the worker says the article doesn't exist (or isn't
// published), so the page can return a real 404. Any other failure throws:
// a worker outage shouldn't get a live article cached as a 404, and ISR
// keeps serving the last good copy when a revalidation throws.
async function fetchArticle(idOrSlug: string): Promise<any> {
  const res = await fetch(WORKER_URL + '/articles/' + encodeURIComponent(idOrSlug), {
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Article fetch failed: ' + res.status);
  return await res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const a = await fetchArticle(decodedId);
  if (!a) return { title: 'Not Found' };
  const title = a.title || 'Khabar Darjeeling';
  const description = clean(a.content || a.summary || '');
  const image = imgUrl(a);
  const url = SITE + '/article/' + (a.slug || id);
  const author = a.submitterName || a.authorName || 'Khabar Darjeeling';
  const published = a.publishedAt || a.$createdAt;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Khabar Darjeeling',
      type: 'article',
      publishedTime: published,
      authors: [author],
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    robots: 'index, follow',
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const a = await fetchArticle(decodedId);
  if (!a) notFound();
  const related = await fetchRelated(a);

  const jsonLd = a ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: (a.title || '').slice(0, 110),
    image: {
      '@type': 'ImageObject',
      url: imgUrl(a),
      width: 1200,
      height: 630,
      caption: a.imageCaption || (a.title || '').slice(0, 110),
    },
    datePublished: a.publishedAt || a.$createdAt,
    dateModified: a.$updatedAt || a.publishedAt || a.$createdAt,
    author: [{ '@type': 'Person', name: a.submitterName || a.authorName || 'Khabar Darjeeling' }],
    publisher: {
      '@type': 'Organization',
      name: 'Khabar Darjeeling',
      logo: { '@type': 'ImageObject', url: SITE + '/assets/logo.png' },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': SITE + '/article/' + id },
    description: clean(a.content || a.summary || ''),
    articleSection: a.genre || a.category || 'News',
  } : null;

  const breadcrumbLd = a ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: a.genre || a.category || 'News', item: SITE + '/genre/' + (a.genre || a.category || 'news').toLowerCase().replace(/\s+/g, '-') },
      { '@type': 'ListItem', position: 3, name: (a.title || '').slice(0, 110) },
    ],
  } : null;

  return (
    <>
      {jsonLd && (
        <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      {breadcrumbLd && (
        <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      )}
      <ArticleClient initialArticle={a} initialRelated={related} />
    </>
  );
}
