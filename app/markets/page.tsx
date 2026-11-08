import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import MarketsClient from './MarketsClient';

const SITE = 'https://khabardarjeeling.in';

export const metadata: Metadata = {
  title: 'Sensex, Gold and Silver Prices Today',
  description: 'Sensex and BSE indices, world gold and silver prices in dollars and rupees, and the dollar-rupee rate, in one place for Darjeeling readers. Delayed market data from TradingView.',
  alternates: { canonical: SITE + '/markets' },
  openGraph: {
    title: 'Sensex, Gold and Silver Prices Today | Khabar Darjeeling',
    description: 'Sensex, world gold and silver prices and USD/INR for Darjeeling readers.',
    url: SITE + '/markets',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default function MarketsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', color: 'var(--color-text)' }}>
      <div style={{ background: 'var(--color-primary)', color: '#fff', padding: '12px 16px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', textDecoration: 'none', fontWeight: 800, fontSize: '18px' }}>
            <img src="/assets/logo.png" alt="" width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }} />
            <span>Khabar Darjeeling</span>
          </Link>
          <Link href="/" style={{ background: '#fff', color: 'var(--color-primary)', padding: '7px 16px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Home</Link>
        </div>
      </div>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 16px 8px' }}>
        <header style={{ borderBottom: '3px double var(--rule-strong)', paddingBottom: '16px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>Markets</p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 'var(--text-h1)', lineHeight: 1.15, color: 'var(--ink)' }}>Sensex, gold and silver</h1>
          <p style={{ margin: '8px 0 0', maxWidth: '620px', fontSize: '14px', lineHeight: 1.5, color: 'var(--color-text-muted)' }}>
            The numbers Darjeeling asks about most: the Sensex, gold, silver and the dollar-rupee rate.
          </p>
        </header>

        <MarketsClient />

        <section style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px', paddingTop: '10px', borderTop: '3px solid var(--rule-strong)', fontFamily: 'var(--font-serif)', fontSize: 'var(--text-h2)', color: 'var(--ink)' }}>Reading the gold and silver prices</h2>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              These are world prices, per troy ounce (about 31 grams), shown in dollars and converted to rupees. They are not the rate at a jeweller&rsquo;s counter.
              The price in Darjeeling or Siliguri is higher because India adds import duty and GST, and the shop adds making charges and its own margin; 22-carat gold is also priced below 24-carat.
              Ask the jeweller for the day&rsquo;s rate before you buy.
            </p>
          </div>
          <div>
            <h2 style={{ margin: '0 0 8px', paddingTop: '10px', borderTop: '3px solid var(--rule-strong)', fontFamily: 'var(--font-serif)', fontSize: 'var(--text-h2)', color: 'var(--ink)' }}>About this data</h2>
            <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
              Prices are supplied by <a href="https://in.tradingview.com/" rel="noopener nofollow" target="_blank" style={{ color: 'var(--color-link)' }}>TradingView</a> and are delayed, so they can differ from the exchange screen.
              They are shown for information only and are not investment advice. When a market is closed you will see the last traded price.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
