'use client';

import { useState } from 'react';

export interface BulletinVideo {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  location: string;
  thumbnail: string;
  viewCount: number;
}

function formatViews(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M views';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K views';
  return n + ' view' + (n === 1 ? '' : 's');
}

export default function GorkhaTVSection({ videos }: { videos: BulletinVideo[] }) {
  const [playing, setPlaying] = useState<BulletinVideo | null>(null);

  if (!videos || videos.length === 0) return null;

  return (
    <div style={{ marginBottom: '32px', background: 'var(--color-surface)', borderRadius: '8px', padding: '24px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap' as const, gap: '8px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span aria-hidden="true">📺</span> GorkhaTV Bulletin
        </h2>
        <a
          href="https://gorkhatv.site/genre/news"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' as const }}
        >
          Watch more on GorkhaTV &rarr;
        </a>
      </div>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 16px' }}>
        Video news from the hills, curated by GorkhaTV
      </p>

      <div
        style={{
          display: 'flex',
          gap: '14px',
          overflowX: 'auto' as const,
          paddingBottom: '4px',
          scrollSnapType: 'x proximity' as const,
          minWidth: 0,
          width: '100%',
        }}
      >
        {videos.map((v) => (
          <button
            key={v.id}
            onClick={() => setPlaying(v)}
            style={{
              flex: '0 0 220px',
              width: '220px',
              textAlign: 'left' as const,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              scrollSnapAlign: 'start' as const,
              fontFamily: 'var(--font-sans)',
            }}
            aria-label={'Play: ' + v.title}
          >
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: '6px', overflow: 'hidden', background: '#000' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.thumbnail} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  left: '6px',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '3px',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.3px',
                }}
              >
                Video
              </span>
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '16px',
                  }}
                >
                  ▶
                </span>
              </span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
              {v.title}
            </div>
            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{v.channel}</span>
              {v.location && (
                <>
                  <span aria-hidden="true">&middot;</span>
                  <span>{v.location}</span>
                </>
              )}
            </div>
            {v.viewCount > 0 && (
              <div style={{ marginTop: '2px', fontSize: '11px', color: 'var(--color-text-muted)' }}>{formatViews(v.viewCount)}</div>
            )}
          </button>
        ))}
      </div>

      {playing && (
        <div
          onClick={() => setPlaying(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '860px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ color: '#e8dfc8', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginRight: '12px' }}>
                {playing.title}
              </span>
              <button
                onClick={() => setPlaying(null)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: '6px', overflow: 'hidden' }}>
              <iframe
                src={'https://www.youtube.com/embed/' + playing.youtubeId + '?autoplay=1'}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={playing.title}
              />
            </div>
            <div style={{ marginTop: '10px', fontSize: '12px', color: '#a89a78', fontFamily: 'var(--font-sans)' }}>
              {playing.channel} · Discovered via{' '}
              <a href="https://gorkhatv.site" target="_blank" rel="noopener noreferrer" style={{ color: '#f5c518' }}>
                GorkhaTV
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
