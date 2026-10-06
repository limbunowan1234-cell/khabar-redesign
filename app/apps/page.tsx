import type { Metadata } from 'next';
import Link from 'next/link';
import AppsClient from './AppsClient';
import type { DownloadItem } from '@/lib/downloadCategories';

const SITE = 'https://khabardarjeeling.in';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

async function fetchDownloads(): Promise<DownloadItem[]> {
  try {
    // Short revalidate so a freshly added app or game shows up within a
    // minute, without every visitor hitting the Worker.
    const res = await fetch(WORKER_URL + '/downloads', { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Apps & Games - Downloads',
  description: 'Download apps, games, magic-trick apps and game materials from Khabar Darjeeling.',
  alternates: { canonical: SITE + '/apps' },
  openGraph: {
    title: 'Apps & Games - Khabar Darjeeling',
    description: 'Download apps, games, magic-trick apps and game materials.',
    url: SITE + '/apps',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default async function AppsPage() {
  const items = await fetchDownloads();

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#c41e3a', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', textDecoration: 'none', fontSize: '18px', fontWeight: 800 }}>Khabar Darjeeling</Link>
        <Link href="/" style={{ background: 'white', color: '#c41e3a', padding: '8px 18px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Home</Link>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '30px', fontWeight: 800, color: '#111827' }}>Apps &amp; Games</h1>
        <p style={{ margin: '0 0 24px', fontSize: '15px', color: '#6b7280', maxWidth: '60ch' }}>
          Apps, games, magic-trick apps and game materials to download.
        </p>
        <AppsClient items={items} workerUrl={WORKER_URL} />
      </div>
    </div>
  );
}
