import type { Metadata } from 'next';
import ProfileClient from './ProfileClient';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';

async function fetchProfileName(userId: string): Promise<string> {
  try {
    const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [userId] }));
    const res = await fetch(
      ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q,
      { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 300 } }
    );
    if (!res.ok) return 'Writer';
    const data = await res.json();
    return data.documents?.[0]?.submitterName || 'Writer';
  } catch {
    return 'Writer';
  }
}

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }): Promise<Metadata> {
  const { userId } = await params;
  const name = await fetchProfileName(userId);
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
  return <ProfileClient userId={userId} />;
}