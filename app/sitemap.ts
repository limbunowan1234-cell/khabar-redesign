import type { MetadataRoute } from 'next';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.space';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getArticles();

  const articleUrls: MetadataRoute.Sitemap = articles.map((a: any) => ({
    url: SITE + '/article/' + (a.slug || a.$id),
    lastModified: new Date(a.$updatedAt || a.publishedAt || a.$createdAt || Date.now()),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 1 },
    { url: SITE + '/contest', lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6 },
    { url: SITE + '/reels', lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6 },
  ];

  return [...staticUrls, ...articleUrls];
}
