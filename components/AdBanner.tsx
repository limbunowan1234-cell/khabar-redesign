'use client';
import { useState, useEffect } from 'react';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

function getImageUrl(fileId: string): string {
  return ENDPOINT + '/storage/buckets/article-image/files/' + fileId + '/view?project=' + PROJECT;
}

export default function AdBanner({ isDarkMode }: { isDarkMode?: boolean }) {
  const [ads, setAds] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/photos/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'type', values: ['ad'] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [50] })),
          { headers: H, credentials: 'include' }
        );
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

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex];
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
  const goNext = () => setCurrentIndex((prev) => (prev + 1) % ads.length);

  return (
    <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
      <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.55)', color: '#f5c518', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', zIndex: 3, textTransform: 'uppercase' }}>
        Sponsored
      </div>

      <div style={{ position: 'relative', width: '100%', height: '200px', backgroundColor: '#1a1a1a' }}>
        <img
          src={getImageUrl(currentAd.imageFileId)}
          alt={currentAd.title || 'Advertisement'}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.75) 100%)' }} />

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
