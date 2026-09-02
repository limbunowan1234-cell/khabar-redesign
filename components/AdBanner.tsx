'use client';
import { useState, useEffect } from 'react';

// Week 42 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function getImageUrl(fileId: string): string {
  return WORKER_URL + '/cdn/articles/' + fileId;
}

// Ad creative arrives in whatever shape the advertiser sent it -- wide
// banner, near-square, or a tall poster-style flyer. A fixed 200px-tall
// box with objectFit:cover only works for the first case; anything
// taller crops most of the image away. Instead this measures each
// image's real aspect ratio (via onLoad) and sizes the box to match --
// cover then never crops, since the box IS the image's own shape.
// Only a very tall poster (aspect < 0.65, e.g. a phone-screenshot flyer)
// gets capped, so one ad can't take over the whole sidebar; capped
// posters switch to objectFit:contain so nothing gets cut off, just
// letterboxed on a dark ground.
const FALLBACK_RATIO = 16 / 9; // used only until the real image loads
const MAX_HEIGHT = 420;
const TALL_POSTER_RATIO = 0.65;

export default function AdBanner({ isDarkMode }: { isDarkMode?: boolean }) {
  const [ads, setAds] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratio, setRatio] = useState(FALLBACK_RATIO);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(WORKER_URL + '/photos?type=ad&limit=50');
        if (res.ok) {
          const data = await res.json();
          setAds(data.documents || []);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (ads.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [ads.length]);

  // Reset to the fallback ratio whenever the visible ad changes, so a
  // slow-loading image doesn't briefly inherit the previous ad's shape.
  useEffect(() => { setRatio(FALLBACK_RATIO); }, [currentIndex]);

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex];
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
  const goNext = () => setCurrentIndex((prev) => (prev + 1) % ads.length);

  const isTallPoster = ratio < TALL_POSTER_RATIO;
  const boxHeight = isTallPoster ? MAX_HEIGHT : undefined;

  return (
    <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
      <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.55)', color: '#f5c518', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', zIndex: 3, textTransform: 'uppercase' }}>
        Sponsored
      </div>

      <div style={{ position: 'relative', width: '100%', aspectRatio: isTallPoster ? undefined : ratio, height: boxHeight, maxHeight: MAX_HEIGHT, backgroundColor: '#1a1a1a' }}>
        <img
          key={currentAd.$id}
          src={getImageUrl(currentAd.imageFileId)}
          alt={currentAd.title || 'Advertisement'}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
          }}
          style={{ width: '100%', height: '100%', objectFit: isTallPoster ? 'contain' : 'cover', display: 'block' }}
        />
        {!isTallPoster && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.75) 100%)' }} />}

        {currentAd.title && (
          <div style={{ position: 'absolute', bottom: '14px', left: '16px', right: '16px', zIndex: 2 }}>
            <p style={{ margin: 0, color: '#fff', fontSize: '15px', fontWeight: '700', lineHeight: 1.3, textShadow: '0 2px 6px rgba(0,0,0,0.5)' }}>
              {currentAd.title}
            </p>
          </div>
        )}

        {ads.length > 1 && (
          <>
            <button
              onClick={goPrev}
              style={{ position: 'absolute', top: '50%', left: '8px', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}
            >
              ‹
            </button>
            <button
              onClick={goNext}
              style={{ position: 'absolute', top: '50%', right: '8px', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}
            >
              ›
            </button>
            <div style={{ position: 'absolute', bottom: '10px', right: '14px', display: 'flex', gap: '5px', zIndex: 3 }}>
              {ads.map((_, i) => (
                <div key={i} onClick={() => setCurrentIndex(i)} style={{ width: '6px', height: '6px', borderRadius: '50%', cursor: 'pointer', backgroundColor: i === currentIndex ? '#f5c518' : 'rgba(255,255,255,0.5)' }} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
