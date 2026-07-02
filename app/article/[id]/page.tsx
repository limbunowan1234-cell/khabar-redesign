import type { Metadata } from 'next';
import ArticleClient from './ArticleClient';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.space';

function imgUrl(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  const id = a?.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return SITE + '/assets/logo.png';
  if (String(id).startsWith('http')) return id;
  return ENDPOINT + '/storage/buckets/article-image/files/' + id + '/view?project=' + PROJECT;
}

function clean(text: string, max = 155): string {
  if (!text) return 'Latest news from Darjeeling and the Gorkha community.';
  const t = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).trim() + '...' : t;
}

async function fetchArticle(id: string): Promise<any> {
  try {
    const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents/' + id, {
      headers: { 'X-Appwrite-Project': PROJECT },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = await fetchArticle(id);
  if (!a) return { title: 'Article | Khabar Darjeeling' };
  const title = a.title || 'Khabar Darjeeling';
  const description = clean(a.content || a.summary || '');
  const image = imgUrl(a);
  const url = SITE + '/article/' + id;
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
  const a = await fetchArticle(id);

  const jsonLd = a ? {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: (a.title || '').slice(0, 110),
    image: [imgUrl(a)],
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
    articleSection: a.category || 'News',
  } : null;

  return (
    <>
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <ArticleClient />
    </>
  );
}
