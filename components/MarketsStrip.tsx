'use client';

import Link from 'next/link';
import TradingViewWidget from '@/components/TradingViewWidget';
import { TICKER_SYMBOLS } from '@/lib/markets';

// Slim Sensex / BSE 500 / gold / silver / USD-INR tape under the home page's news ticker.
const CONFIG = { symbols: TICKER_SYMBOLS, showSymbolLogo: false, displayMode: 'adaptive' };

export default function MarketsStrip({ isDarkMode }: { isDarkMode?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--rule)', background: 'var(--color-bg)', minHeight: 84 }}>
      <Link href="/markets" style={{ flexShrink: 0, padding: '0 14px', fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', color: 'var(--color-primary)', textDecoration: 'none', textTransform: 'uppercase' }}>
        Markets
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <TradingViewWidget widget="ticker-tape" config={CONFIG} height={84} isDarkMode={isDarkMode} showAttribution={false} label="Sensex, gold and silver prices" />
      </div>
      <a href="https://in.tradingview.com/" rel="noopener nofollow" target="_blank" style={{ flexShrink: 0, padding: '0 12px', fontSize: '10px', color: 'var(--color-text-muted)', textDecoration: 'none' }}>
        Data: TradingView
      </a>
    </div>
  );
}
