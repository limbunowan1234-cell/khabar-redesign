import type { Metadata } from 'next';
import ContestClient from './ContestClient';

// Week 10 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

async function fetchContestEntries(): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?contest=1&limit=100', { next: { revalidate: 300 } });
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
