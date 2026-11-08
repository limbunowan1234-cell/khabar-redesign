'use client';

import TradingViewWidget from '@/components/TradingViewWidget';
import { OVERVIEW_TABS, TICKER_SYMBOLS } from '@/lib/markets';

const TAPE = { symbols: TICKER_SYMBOLS, showSymbolLogo: false, displayMode: 'adaptive' };
const OVERVIEW = { tabs: OVERVIEW_TABS, showChart: true, dateRange: '1M', showSymbolLogo: false, plotLineColorGrowing: 'rgba(31, 122, 61, 1)', plotLineColorFalling: 'rgba(196, 30, 58, 1)' };

export default function MarketsClient() {
  return (
    <div>
      <div style={{ borderBottom: '1px solid var(--rule)', marginBottom: '16px' }}>
        <TradingViewWidget widget="ticker-tape" config={TAPE} height={84} showAttribution={false} label="Price tape" />
      </div>
      <TradingViewWidget widget="market-overview" config={OVERVIEW} height={560} label="Indices, gold, silver and currency prices" />
    </div>
  );
}
