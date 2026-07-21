import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';

async function fetchProfileData(userId: string): Promise<{ profile: any; articles: any[]; writerRank: number | null; contestRank: number | null }> {
  try {
    const profileRes = await fetch(
      ENDPOINT + '/databases/' + DB + '/collections/profiles/documents?queries[]=' +
      encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] })),
      { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 300 } }
    );
    const profileData = profileRes.ok ? await profileRes.json() : { documents: [] };
    const profile = profileData.documents?.[0] || null;

    const articlesRes = await fetch(
      ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
      encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [userId] })) +
      '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] })) +
      '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [50] })) + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'select', values: ['$id','$createdAt','title','genre','category','locationDistrict','imageFileId','youtube_id','views','isContestEntry','isFeatured','isBreaking','publishedAt','slug','submitterName','authorName'] })),
      { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 300 } }
    );
    const articlesData = articlesRes.ok ? await articlesRes.json() : { documents: [] };
    const articles = articlesData.documents || [];

    let writerRank: number | null = null;
    let contestRank: number | null = null;
    try {
      const allRes = await fetch(
        ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
        encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] })) +
        '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [1000] })) + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'select', values: ['$id','submitterId','views','isContestEntry'] })),
        { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 600 } }
      );
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
    alternates: { canonical: 'https://khabardarjeeling.space/profile/' + userId },
    openGraph: {
      title,
      description,
      url: 'https://khabardarjeeling.space/profile/' + userId,
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
