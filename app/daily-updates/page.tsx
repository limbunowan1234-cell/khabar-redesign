import type { Metadata } from 'next';
import DailyUpdatesPosterClient from '@/components/DailyUpdatesPosterClient';

// Week 36 of the Cloudflare migration (see cloudflare/README.md): reads
// from the Worker/D1 instead of Appwrite directly -- the last of the
// direct-Appwrite article reads.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SITE = 'https://khabardarjeeling.in';

const OTHER_DISTRICTS = ['Kalimpong', 'Kurseong', 'Mirik', 'Siliguri'];

async function fetchArticles(qs: string): Promise<any[]> {
  try {
    const res = await fetch(`${WORKER_URL}/articles?${qs}`, { next: { revalidate: 300 } });
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
  // status defaults to published on the Worker when omitted, and sort
  // defaults to createdAtDesc -- matching every query shape below.
  const [darjeelingArticles, otherDistrictArticles, headlineCandidates, recentArticles] = await Promise.all([
    fetchArticles('district=' + encodeURIComponent('Darjeeling') + '&limit=6'),
    fetchArticles('district=' + encodeURIComponent(OTHER_DISTRICTS.join(',')) + '&limit=6'),
    fetchArticles('limit=1'),
    fetchArticles('limit=12'),
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
