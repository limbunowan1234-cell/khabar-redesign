'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CATEGORY_LABELS: Record<string, string> = {
  poetry: 'काव्य',
  essay: 'निबन्ध',
  photo: 'फोटो'
};

export default function BhasaDiwasWidget() {
  const [textSubmissions, setTextSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/bhasa-diwas/submissions?category=all');
        const data = await res.json();
        const all = data.submissions || [];
        setTextSubmissions(all.filter((s: any) => s.category !== 'photo').slice(0, 3));
      } catch (err) {
        console.error('Failed to load bhasa diwas submissions:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ marginBottom: '32px', background: 'var(--color-surface)', borderRadius: '8px', padding: '24px' }}>
      {/* HERO BANNER */}
      <Link href="/nepali-bhasa-diwas" style={{ textDecoration: 'none' }}>
        <div style={{
          position: 'relative',
          borderRadius: '6px',
          overflow: 'hidden',
          height: '160px',
          marginBottom: '18px',
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
            <div style={{ color: 'white', fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-serif)', textShadow: '0 2px 10px rgba(0,0,0,0.5)', marginBottom: '4px' }}>
              नेपाली भाषा दिवस
            </div>
            <div style={{ color: 'rgba(255,255,255,0.92)', fontFamily: 'var(--font-sans)', fontSize: '13px', marginBottom: '10px' }}>
              सबमिशन खुला भयो
            </div>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', border: '1.5px solid var(--color-accent)', borderRadius: '20px', padding: '6px 16px', color: 'white', fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600 }}>
              आफ्नो रचना पठाउनुहोस्
            </div>
          </div>
        </div>
      </Link>

      {/* LATEST TEXT SUBMISSIONS */}
      {!loading && textSubmissions.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              पछिल्ला रचनाहरू
            </h2>
            <Link href="/nepali-bhasa-diwas" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
              सबै हेर्नुहोस् &rarr;
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {textSubmissions.map((sub: any) => (
              <Link key={sub.$id} href={'/nepali-bhasa-diwas/' + sub.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  background: 'var(--color-bg)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  borderLeft: '3px solid var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>
                    {CATEGORY_LABELS[sub.category] || sub.category}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                    flex: 1
                  }}>
                    {sub.title}
                  </span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
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