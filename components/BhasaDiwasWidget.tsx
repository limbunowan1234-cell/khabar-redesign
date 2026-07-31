'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CATEGORY_LABELS: Record<string, string> = {
  poetry: 'काव्य',
  essay: 'निबन्ध',
  photo: 'फोटो'
};

export default function BhasaDiwasWidget({ isDarkMode }: { isDarkMode?: boolean }) {
  const [textSubmissions, setTextSubmissions] = useState<any[]>([]);
  const [featuredPhotos, setFeaturedPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/bhasa-diwas/submissions?category=all');
        const data = await res.json();
        const all = data.submissions || [];
        setTextSubmissions(all.filter((s: any) => s.category !== 'photo').slice(0, 3));
        const photos = all.filter((s: any) => s.category === 'photo');
        const featured = photos.filter((s: any) => s.isFeatured);
        setFeaturedPhotos((featured.length > 0 ? featured : photos).slice(0, 2));
      } catch (err) {
        console.error('Failed to load bhasa diwas submissions:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* HERO BANNER */}
      <Link href="/nepali-bhasa-diwas" style={{ textDecoration: 'none' }}>
        <div style={{
          position: 'relative',
          borderRadius: '14px',
          overflow: 'hidden',
          height: '160px',
          marginBottom: '16px',
          backgroundImage: 'linear-gradient(105deg, rgba(30,10,10,0.85) 0%, rgba(60,15,15,0.55) 45%, rgba(60,15,15,0.2) 75%), url(/assets/bhasa-diwas-hero.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          cursor: 'pointer'
        }}>
          <div>
            <div style={{ color: 'white', fontSize: '24px', fontWeight: 700, fontFamily: 'Georgia, serif', textShadow: '0 2px 10px rgba(0,0,0,0.5)', marginBottom: '4px' }}>
              नेपाली भाषा दिवस
            </div>
            <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: '13px', marginBottom: '10px' }}>
              सबमिशन खुला भयो
            </div>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', border: '1.5px solid #facc15', borderRadius: '20px', padding: '6px 16px', color: 'white', fontSize: '12px', fontWeight: 600 }}>
              आफ्नो रचना पठाउनुहोस्
            </div>
          </div>
        </div>
      </Link>

      {/* FEATURED PHOTOS (max 2, small) */}
      {!loading && featuredPhotos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: featuredPhotos.length === 1 ? 'minmax(140px, 200px)' : 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
          {featuredPhotos.map((photo: any) => (
            <Link key={photo.$id} href={'/nepali-bhasa-diwas/' + photo.$id} style={{ textDecoration: 'none' }}>
              <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', height: '90px', background: '#e5e7eb' }}>
                {photo.imageFileId && (
                  <img
                    src={'/api/image-proxy?fileId=' + photo.imageFileId + '&bucket=6a67a307002f71e8dcf5'}
                    alt={photo.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <div style={{ position: 'absolute', top: '6px', left: '6px', background: '#facc15', color: '#78350f', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                  उत्कृष्ट
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* LATEST TEXT SUBMISSIONS */}
      {!loading && textSubmissions.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '18px', backgroundColor: '#b91c1c', borderRadius: '2px', display: 'inline-block' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: isDarkMode ? '#fff' : '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                पछिल्ला रचनाहरू
              </h3>
            </div>
            <Link href="/nepali-bhasa-diwas" style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#888', textDecoration: 'none' }}>
              सबै हेर्नुहोस् →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {textSubmissions.map((sub: any) => (
              <Link key={sub.$id} href={'/nepali-bhasa-diwas/' + sub.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  background: isDarkMode ? '#1e1e1e' : 'white',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  borderLeft: '3px solid #b91c1c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 700, flexShrink: 0 }}>
                    {CATEGORY_LABELS[sub.category] || sub.category}
                  </span>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: isDarkMode ? '#fff' : '#1a1a1a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                    flex: 1
                  }}>
                    {sub.title}
                  </span>
                  <span style={{ fontSize: '11px', color: isDarkMode ? '#999' : '#888', flexShrink: 0 }}>
                    {sub.submitterName}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
