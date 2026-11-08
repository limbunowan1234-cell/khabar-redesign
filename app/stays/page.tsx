import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import StaysClient from './StaysClient';
import { STAYS, STAYS_CHECKED } from '@/lib/stays';

const SITE = 'https://khabardarjeeling.in';

export const metadata: Metadata = {
  title: 'Stays in Darjeeling - Heritage Hotels, Tea Estates and Local Hotels',
  description: "Find a place to stay in Darjeeling: heritage hotels, tea estate bungalows and local hotels, with the property's own rates, phone and email. Send an enquiry directly.",
  alternates: { canonical: SITE + '/stays' },
  openGraph: {
    title: 'Stays in Darjeeling | Khabar Darjeeling',
    description: 'Heritage hotels, tea estates and local hotels in Darjeeling. Enquire directly with the stay.',
    url: SITE + '/stays',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default function StaysPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
      <div style={{ background: 'var(--color-primary)', color: '#fff', padding: '12px 16px' }}>
        <div style={{ maxWidth: '1180px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: '18px' }}>
            <img src="/assets/logo.png" alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }} />
            <span>Khabar Darjeeling</span>
          </Link>
          <Link href="/" style={{ background: '#fff', color: 'var(--color-primary)', padding: '7px 16px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Home</Link>
        </div>
      </div>
      <StaysClient stays={STAYS} checked={STAYS_CHECKED} />
      <SiteFooter />
    </div>
  );
}
