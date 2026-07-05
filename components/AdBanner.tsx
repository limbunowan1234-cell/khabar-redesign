'use client';
import { useState, useEffect } from 'react';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
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
    }, 6000);
    return () => clearInterval(interval);
  }, [ads.length]);

  if (ads.length === 0) return null;

  const currentAd = ads[currentIndex];

  return (
    <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px', border: '1px solid ' + (isDarkMode ? '#333' : '#eee') }}>
      <div style={{ position: 'absolute', top: '8px', left: '8px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', zIndex: 2 }}>
        Sponsored
      </div>
      <img
        src={getImageUrl(currentAd.imageFileId)}
        alt={currentAd.title || 'Advertisement'}
        style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}
      />
      {ads.length > 1 && (
        <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px' }}>
          {ads.map((_, i) => (
            <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.4)' }} />
          ))}
        </div>
      )}
    </div>
  );
}
