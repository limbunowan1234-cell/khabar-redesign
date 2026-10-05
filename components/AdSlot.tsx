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
// - the creative image for this viewport must actually load (flat-image
//   placements only -- a native card is real HTML, so if its optional
//   photo fails the card still shows, just without the photo).
// Any of those failing hides the slot entirely -- no broken-image icon,
// no placeholder box, same "fail gracefully" convention as every other
// best-effort widget in this app (WeatherAirWidget, etc.).
export default function AdSlot({ placement }: { placement?: AdPlacement }) {
  const [serverActive, setServerActive] = useState<boolean | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [cardPhotoFailed, setCardPhotoFailed] = useState(false);
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

  const hasCreative = !!(placement?.card || placement?.images);
  const live = !!placement?.active && hasCreative && serverActive === true && !(imgFailed && !placement?.card);

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

  // A third-party advertiser's link leaves the site (new tab, rel=sponsored
  // so it isn't an endorsement signal). Our own pages -- e.g. the
  // fundraiser -- are just navigation: same tab, no sponsored rel.
  const external = /^https?:\/\//i.test(placement.href);
  const { card, images } = placement;

  return (
    <a
      ref={ref}
      href={placement.href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer sponsored' : undefined}
      onClick={() => track('click')}
      style={{ display: 'block', textDecoration: 'none', marginBottom: '20px' }}
    >
      <span style={{ display: 'block', fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {placement.label || 'Advertisement'}
      </span>
      {card ? (
        // Fixed brand colors (not theme variables) on purpose: this reads the
        // same in light and dark mode, and matches the red strip across the
        // top of the homepage that already links to the same page.
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '14px',
            padding: '14px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #c41e3a, #8f1428)',
            borderBottom: '3px solid #f5c518',
            color: '#fff',
          }}
        >
          {card.image && !cardPhotoFailed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image}
              alt={placement.alt}
              onError={() => setCardPhotoFailed(true)}
              style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, border: '2px solid rgba(255,255,255,0.85)' }}
            />
          )}
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: 800, lineHeight: 1.25, marginBottom: '4px' }}>{card.headline}</div>
            <div style={{ fontSize: '13px', lineHeight: 1.45, opacity: 0.95, marginBottom: '10px' }}>{card.body}</div>
            <span style={{ display: 'inline-block', background: '#f5c518', color: '#4a0d17', fontSize: '13px', fontWeight: 800, padding: '7px 14px', borderRadius: '999px' }}>
              {card.cta} &rarr;
            </span>
          </div>
        </div>
      ) : images ? (
        <picture>
          <source media="(max-width: 640px)" srcSet={images.mobile} />
          <source media="(max-width: 1024px)" srcSet={images.tablet} />
          <img
            src={images.desktop}
            alt={placement.alt}
            style={{ width: '100%', borderRadius: '8px', display: 'block' }}
            onError={() => setImgFailed(true)}
          />
        </picture>
      ) : null}
    </a>
  );
}
