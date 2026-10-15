import type { Metadata } from 'next';
import Link from 'next/link';
import SubmitClient from './SubmitClient';
import SiteFooter from '@/components/SiteFooter';
import styles from '../apps.module.css';

export const metadata: Metadata = {
  title: 'Submit Your App',
  description: 'Share your app or game with the Gorkha community on Khabar Apps. Free to list, reviewed before it goes live.',
  alternates: { canonical: 'https://khabardarjeeling.in/apps/submit' },
};

export default function SubmitAppPage() {
  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/" className={styles.brand}>Khabar Darjeeling</Link>
          <div className={styles.topLinks}>
            <Link href="/apps" className={styles.pillLight}>Browse apps</Link>
          </div>
        </div>
      </div>
      <SubmitClient />
      <SiteFooter />
    </div>
  );
}
