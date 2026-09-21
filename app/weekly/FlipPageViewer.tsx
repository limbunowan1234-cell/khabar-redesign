'use client';

import { useState, useEffect, useCallback } from 'react';

interface FlipPageViewerProps {
  pages: string[]; // data URLs, one per rendered page
  issueLabel: string;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
}

export default function FlipPageViewer({ pages, issueLabel, onClose, onDownload, downloading }: FlipPageViewerProps) {
  const [current, setCurrent] = useState(0);
  const [flipping, setFlipping] = useState<'next' | 'prev' | null>(null);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= pages.length || idx === current || flipping) return;
    setFlipping(idx > current ? 'next' : 'prev');
    setTimeout(() => {
      setCurrent(idx);
      setFlipping(null);
    }, 260);
  }, [current, flipping, pages.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goTo(current + 1);
      else if (e.key === 'ArrowLeft') goTo(current - 1);
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo, onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#1a1712', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', backgroundColor: '#0f0d0a', borderBottom: '1px solid #2a251d', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#e8dfc8', fontSize: '20px', cursor: 'pointer', padding: '4px 8px' }} aria-label="Close">✕</button>
          <span style={{ color: '#e8dfc8', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{issueLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ color: '#a89a78', fontSize: '13px' }}>{current + 1} / {pages.length}</span>
          <button onClick={onDownload} disabled={downloading} style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '7px 14px', borderRadius: '18px', fontSize: '12px', fontWeight: 700, cursor: downloading ? 'default' : 'pointer', opacity: downloading ? 0.6 : 1, whiteSpace: 'nowrap' }}>
            {downloading ? 'Preparing…' : '⬇ PDF'}
          </button>
        </div>
      </div>

      {/* Main page area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', padding: '16px' }}>
        <button
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: '44px', height: '44px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '20px', cursor: current === 0 ? 'default' : 'pointer', opacity: current === 0 ? 0.25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Previous page"
        >‹</button>

        <div
          style={{
            height: '100%',
            width: '100%',
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            transform: flipping === 'next' ? 'perspective(1600px) rotateY(-8deg) scale(0.97)' : flipping === 'prev' ? 'perspective(1600px) rotateY(8deg) scale(0.97)' : 'perspective(1600px) rotateY(0deg) scale(1)',
            transition: 'transform 0.26s ease',
            transformOrigin: flipping === 'next' ? 'left center' : 'right center',
          }}
        >
          {pages[current] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pages[current]} alt={`Page ${current + 1}`} style={{ maxHeight: '100%', maxWidth: '100%', height: 'auto', width: 'auto', objectFit: 'contain', display: 'block', background: '#fff' }} />
          )}
        </div>

        <button
          onClick={() => goTo(current + 1)}
          disabled={current === pages.length - 1}
          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: '44px', height: '44px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '20px', cursor: current === pages.length - 1 ? 'default' : 'pointer', opacity: current === pages.length - 1 ? 0.25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Next page"
        >›</button>
      </div>

      {/* Thumbnail strip */}
      <div style={{ display: 'flex', gap: '10px', padding: '10px 16px', backgroundColor: '#0f0d0a', borderTop: '1px solid #2a251d', overflowX: 'auto', flexShrink: 0 }}>
        {pages.map((src, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            style={{ flexShrink: 0, padding: 0, border: i === current ? '2px solid #c41e3a' : '2px solid transparent', borderRadius: '4px', cursor: 'pointer', background: 'none', opacity: i === current ? 1 : 0.6 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Page ${i + 1} thumbnail`} style={{ height: '70px', display: 'block', borderRadius: '2px' }} />
          </button>
        ))}
      </div>
    </div>
  );
}
