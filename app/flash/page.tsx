import type { Metadata } from 'next';
import FlashFeed, { type Flash } from './FlashFeed';

// Flash News: short, photo-first updates posted by readers and reporters
// (from the Android app 1.4.0). Shown as a full-screen swipe-up photo
// feed, like Shorts but photos (see FlashFeed). Stored as articles with
// kind = 'flash', so each one opens on the normal /article/[slug] page.

const SITE = 'https://khabardarjeeling.in';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

async function fetchFlash(): Promise<Flash[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?kind=flash&limit=60&stats=1', { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Flash News: Quick Photo Updates from the Hills',
  description: 'Short photo updates from Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and Sikkim, posted as things happen.',
  alternates: { canonical: SITE + '/flash' },
  openGraph: {
    title: 'Flash News - Khabar Darjeeling',
    description: 'Quick photo updates from the hills, as they happen.',
    url: SITE + '/flash',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default async function FlashNewsPage() {
  const items = await fetchFlash();
  return <FlashFeed items={items} />;
}
