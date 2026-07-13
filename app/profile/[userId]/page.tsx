import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';

async function fetchProfileData(userId: string): Promise<{ profile: any; articles: any[] }> {
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
      '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [50] })),
      { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 300 } }
    );
    const articlesData = articlesRes.ok ? await articlesRes.json() : { documents: [] };
    const articles = articlesData.documents || [];

    return { profile, articles };
  } catch {
    return { profile: null, articles: [] };
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
  const { profile, articles } = await fetchProfileData(userId);
  return <ProfileClient userId={userId} initialProfile={profile} initialArticles={articles} />;
}
