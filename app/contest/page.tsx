import type { Metadata } from 'next';
import ContestClient from './ContestClient';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';

async function fetchContestEntries(): Promise<any[]> {
  try {
    const res = await fetch(
      ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
      encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'isContestEntry', values: [true] })) +
      '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] })) +
      '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
      { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Story Contest 2026',
  description: 'Enter the Khabar Darjeeling Story Contest 2026. Share your stories from Darjeeling and the Gorkha community for a chance to win prizes.',
  alternates: { canonical: 'https://khabardarjeeling.in/contest' },
  openGraph: {
    title: 'Story Contest 2026 | Khabar Darjeeling',
    description: 'Enter the Khabar Darjeeling Story Contest 2026. Share your stories from Darjeeling and the Gorkha community.',
    url: 'https://khabardarjeeling.in/contest',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default async function Page() {
  const entries = await fetchContestEntries();
  return <ContestClient initialEntries={entries} />;
}
