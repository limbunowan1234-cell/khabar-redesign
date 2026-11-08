'use client';

import { useEffect, useRef, useState } from 'react';

// Embeds one of TradingView's free external widgets (https://www.tradingview.com/widget/).
// Their terms require the widget's own attribution link to stay visible, so `showAttribution`
// should only be turned off where the surrounding page shows the credit itself.
interface Props {
  widget: string; // e.g. 'ticker-tape', 'market-overview'
  config: Record<string, unknown>;
  height: number;
  isDarkMode?: boolean;
  showAttribution?: boolean;
  label: string; // accessible name for the region
}

export default function TradingViewWidget({ widget, config, height, isDarkMode, showAttribution = true, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [dark, setDark] = useState(!!isDarkMode);

  // follow the site's dark mode (HomeClient mirrors it to <html data-theme>)
  useEffect(() => {
    const read = () => setDark(isDarkMode ?? document.documentElement.getAttribute('data-theme') === 'dark');
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, [isDarkMode]);

  // only load third-party script when the widget is about to scroll into view
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !visible) return;
    el.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    el.appendChild(inner);
    const script = document.createElement('script');
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
    script.async = true;
    script.text = JSON.stringify({ ...config, colorTheme: dark ? 'dark' : 'light', isTransparent: true, locale: 'in', width: '100%', height });
    el.appendChild(script);
    return () => { el.innerHTML = ''; };
  }, [visible, dark, widget, height, config]);

  return (
    <div role="region" aria-label={label}>
      <div ref={host} className="tradingview-widget-container" style={{ minHeight: height, width: '100%' }} />
      {showAttribution && (
        <div style={{ fontSize: '11px', textAlign: 'right', padding: '4px 2px 0' }}>
          <a href="https://in.tradingview.com/" rel="noopener nofollow" target="_blank" style={{ color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Track all markets on TradingView
          </a>
        </div>
      )}
    </div>
  );
}
