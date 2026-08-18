import type { Metadata } from 'next';
import DailyUpdatesPosterClient from '@/components/DailyUpdatesPosterClient';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.in';
const H = { 'X-Appwrite-Project': PROJECT };

const OTHER_DISTRICTS = ['Kalimpong', 'Kurseong', 'Mirik', 'Siliguri'];

async function fetchArticles(queries: string[]): Promise<any[]> {
  try {
    const qs = queries.map((q) => 'queries[]=' + encodeURIComponent(q)).join('&');
    const res = await fetch(`${ENDPOINT}/databases/${DB}/collections/articles/documents?${qs}`, {
      headers: H,
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Daily Updates | Khabar Darjeeling',
  description: 'A shareable daily roundup of the top news from Darjeeling and the Gorkha hills — download as an image or PDF.',
  alternates: { canonical: SITE + '/daily-updates' },
};

export default async function DailyUpdatesPage() {
  const [darjeelingArticles, otherDistrictArticles, headlineCandidates, recentArticles] = await Promise.all([
    fetchArticles([
      JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] }),
      JSON.stringify({ method: 'equal', attribute: 'locationDistrict', values: ['Darjeeling'] }),
      JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }),
      JSON.stringify({ method: 'limit', values: [6] }),
    ]),
    fetchArticles([
      JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] }),
      JSON.stringify({ method: 'equal', attribute: 'locationDistrict', values: OTHER_DISTRICTS }),
      JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }),
      JSON.stringify({ method: 'limit', values: [6] }),
    ]),
    fetchArticles([
      JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] }),
      JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }),
      JSON.stringify({ method: 'limit', values: [1] }),
    ]),
    fetchArticles([
      JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] }),
      JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }),
      JSON.stringify({ method: 'limit', values: [12] }),
    ]),
  ]);

  // Prefer a breaking/featured story for the top headline; fall back to the
  // single most recent published article if neither exists yet.
  const breakingOrFeatured = recentArticles.find((a) => a.isBreaking || a.isFeatured);
  const topHeadline = breakingOrFeatured || headlineCandidates[0] || null;

  const usedIds = new Set([
    topHeadline?.$id,
    ...darjeelingArticles.map((a) => a.$id),
    ...otherDistrictArticles.map((a) => a.$id),
  ]);
  const otherNews = recentArticles.filter((a) => !usedIds.has(a.$id)).slice(0, 4);

  return (
    <DailyUpdatesPosterClient
      darjeelingArticles={darjeelingArticles}
      otherDistrictArticles={otherDistrictArticles}
      topHeadline={topHeadline}
      otherNews={otherNews}
    />
  );
}
