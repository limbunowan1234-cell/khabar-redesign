'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdPlacement } from '@/lib/adConfig';

// Renders one ad placement, or nothing at all. Nothing is the default:
// - a placement must actually be passed (lib/adConfig.ts's AD_PLACEMENTS
//   is empty until a real, verified advertiser exists -- call sites like
//   HomeClient.tsx's <AdSlot placement={AD_PLACEMENTS.homepageHeroBanner} />
//   then pass undefined, which this must handle rather than crash on), AND
// - placement.active must be true (the config-level kill switch), AND
// - the D1 ad_campaigns row must also say active (server-side kill
//   switch -- catches a stale deployed config without needing a redeploy
//   to turn a campaign off), AND
// - the creative image for this viewport must actually load.
// Any of those failing hides the slot entirely -- no broken-image icon,
// no placeholder box, same "fail gracefully" convention as every other
// best-effort widget in this app (WeatherAirWidget, etc.).
export default function AdSlot({ placement }: { placement?: AdPlacement }) {
  const [serverActive, setServerActive] = useState<boolean | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [visitorId, setVisitorId] = useState('');
  const trackedImpression = useRef(false);
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    try {
      let id = localStorage.getItem('kd_visitor_id');
      if (!id) {
        id = crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
        localStorage.setItem('kd_visitor_id', id);
      }
      setVisitorId(id);
    } catch { /* localStorage unavailable, tracking is best-effort */ }
  }, []);

  useEffect(() => {
    if (!placement?.active) return; // no placement configured, or config says off -- don't even ask the server
    fetch('https://khabar-worker.limbunowan1234.workers.dev/ads/campaign/' + encodeURIComponent(placement.campaignId))
      .then((r) => (r.ok ? r.json() : { active: false }))
      .then((d) => setServerActive(!!d.active))
      .catch(() => setServerActive(false));
  }, [placement?.active, placement?.campaignId]);

  const live = !!placement?.active && serverActive === true && !imgFailed;

  function deviceType(): string {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    return w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
  }

  function track(eventType: 'impression' | 'click') {
    if (!placement) return; // can't happen when live, but keeps this typesafe on its own
    fetch('/api/ads/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: placement.campaignId,
        placementId: placement.id,
        eventType,
        deviceType: deviceType(),
        visitorId,
        pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {});
  }

  useEffect(() => {
    if (!live || trackedImpression.current || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !trackedImpression.current) {
          trackedImpression.current = true;
          track('impression');
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [live]);

  if (!live || !placement) return null;

  return (
    <a
      ref={ref}
      href={placement.href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() => track('click')}
      style={{ display: 'block', textDecoration: 'none', marginBottom: '20px' }}
    >
      <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        Advertisement
      </span>
      <picture>
        <source media="(max-width: 640px)" srcSet={placement.images.mobile} />
        <source media="(max-width: 1024px)" srcSet={placement.images.tablet} />
        <img
          src={placement.images.desktop}
          alt={placement.alt}
          style={{ width: '100%', borderRadius: '8px', display: 'block' }}
          onError={() => setImgFailed(true)}
        />
      </picture>
    </a>
  );
}
