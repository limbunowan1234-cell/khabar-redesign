import type { Metadata } from 'next';
import Link from 'next/link';
import AppsClient from './AppsClient';
import SiteFooter from '@/components/SiteFooter';
import styles from './apps.module.css';
import { WORKER_URL, type DownloadItem } from '@/lib/downloadCategories';

const SITE = 'https://khabardarjeeling.in';

async function fetchApps(): Promise<DownloadItem[]> {
  try {
    // Short revalidate so a freshly approved app shows up within a minute,
    // without every visitor hitting the Worker.
    const res = await fetch(WORKER_URL + '/downloads?limit=200', { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Apps & Games from the Hills',
  description: 'Discover and download apps, games and tools made in Darjeeling, Sikkim and the Gorkha community - or submit your own.',
  alternates: { canonical: SITE + '/apps' },
  openGraph: {
    title: 'Apps & Games from the Hills - Khabar Darjeeling',
    description: 'Discover and download apps, games and tools made by the Gorkha community.',
    url: SITE + '/apps',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default async function AppsPage() {
  const items = await fetchApps();

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/" className={styles.brand}>Khabar Darjeeling</Link>
          <div className={styles.topLinks}>
            <Link href="/" className={styles.pillGhost}>Home</Link>
            <Link href="/apps/submit" className={styles.pillLight}>Submit your app</Link>
          </div>
        </div>
      </div>
      <AppsClient items={items} />
      <SiteFooter />
    </div>
  );
}
