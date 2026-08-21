import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';

// Week 8 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

async function fetchProfileData(userId: string): Promise<{ profile: any; articles: any[]; writerRank: number | null; contestRank: number | null }> {
  try {
    const profileRes = await fetch(WORKER_URL + '/profiles/' + encodeURIComponent(userId), { next: { revalidate: 300 } });
    const profile = profileRes.ok ? await profileRes.json() : null;

    const articlesRes = await fetch(WORKER_URL + '/articles?submitterId=' + encodeURIComponent(userId) + '&limit=50', { next: { revalidate: 300 } });
    const articlesData = articlesRes.ok ? await articlesRes.json() : { documents: [] };
    const articles = articlesData.documents || [];

    let writerRank: number | null = null;
    let contestRank: number | null = null;
    try {
      const allRes = await fetch(WORKER_URL + '/articles?limit=1000', { next: { revalidate: 600 } });
      if (allRes.ok) {
        const allData = await allRes.json();
        const allArticles = allData.documents || [];

        const writerTotals: Record<string, number> = {};
        for (const a of allArticles) {
          if (!a.submitterId) continue;
          writerTotals[a.submitterId] = (writerTotals[a.submitterId] || 0) + (a.views || 0);
        }
        const rankedWriters = Object.entries(writerTotals).sort((a, b) => b[1] - a[1]);
        const wIdx = rankedWriters.findIndex(([id]) => id === userId);
        if (wIdx !== -1 && wIdx < 10) writerRank = wIdx + 1;

        const contestEntries = allArticles.filter((a: any) => a.isContestEntry);
        const rankedContest = [...contestEntries].sort((a: any, b: any) => (b.views || 0) - (a.views || 0));
        const cIdx = rankedContest.findIndex((a: any) => a.submitterId === userId);
        if (cIdx !== -1 && cIdx < 10) contestRank = cIdx + 1;
      }
    } catch {}

    return { profile, articles, writerRank, contestRank };
  } catch {
    return { profile: null, articles: [], writerRank: null, contestRank: null };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const { profile, articles } = await fetchProfileData(userId);
  const name = profile?.displayName || articles[0]?.submitterName || 'Writer';
  const title = name + ' - Khabar Darjeeling';
  const description = 'Read articles and stories by ' + name + ' on Khabar Darjeeling, the digital home of Darjeeling news.';
  return {
    title,
    description,
    alternates: { canonical: 'https://khabardarjeeling.in/profile/' + userId },
    openGraph: {
      title,
      description,
      url: 'https://khabardarjeeling.in/profile/' + userId,
      siteName: 'Khabar Darjeeling',
      type: 'profile',
    },
  };
}

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { profile, articles, writerRank, contestRank } = await fetchProfileData(userId);
  return <ProfileClient userId={userId} initialProfile={profile} initialArticles={articles} writerRank={writerRank} contestRank={contestRank} />;
}
