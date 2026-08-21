import type { MetadataRoute } from 'next';
const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.in';
// Week 6 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
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
async function getBhasaDiwasSubmissions(): Promise<any[]> {
  try {
    const q1 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [500] }));
    const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/bhasa_diwas_submissions/documents?queries[]=' + q1 + '&queries[]=' + q2, {
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
async function getPhotos(): Promise<any[]> {
  try {
    const q1 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [500] }));
    const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/photography/documents?queries[]=' + q1 + '&queries[]=' + q2, {
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
  const [articles, submissions, photos] = await Promise.all([getArticles(), getBhasaDiwasSubmissions(), getPhotos()]);
  const articleUrls: MetadataRoute.Sitemap = articles.map((a: any) => ({
    url: SITE + '/article/' + (a.slug || a.$id),
    lastModified: new Date(a.$updatedAt || a.publishedAt || a.$createdAt || Date.now()),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));
  const submissionUrls: MetadataRoute.Sitemap = submissions.map((s: any) => ({
    url: SITE + '/nepali-bhasa-diwas/' + s.$id,
    lastModified: new Date(s.$updatedAt || s.$createdAt || Date.now()),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));
  const photoUrls: MetadataRoute.Sitemap = photos.map((p: any) => ({
    url: SITE + '/hills-in-frame/' + p.$id,
    lastModified: new Date(p.$updatedAt || p.$createdAt || Date.now()),
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }));
  const staticUrls: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: new Date(), changeFrequency: 'hourly' as const, priority: 1 },
    { url: SITE + '/contest', lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6 },
    { url: SITE + '/reels', lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6 },
    { url: SITE + '/nepali-bhasa-diwas', lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.7 },
    { url: SITE + '/hills-in-frame', lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.6 },
    { url: SITE + '/weekly', lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: SITE + '/about', lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.4 },
    { url: SITE + '/contact', lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.3 },
  ];
  return [...staticUrls, ...articleUrls, ...submissionUrls, ...photoUrls];
}