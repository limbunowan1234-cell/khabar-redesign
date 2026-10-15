'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './apps.module.css';
import { imageUrl } from '@/lib/downloadCategories';

export default function AppGallery({ shots, title }: { shots: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);

  const go = useCallback((delta: number) => {
    setOpen((cur) => (cur === null ? cur : Math.min(Math.max(cur + delta, 0), shots.length - 1)));
  }, [shots.length]);

  useEffect(() => {
    if (open === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(null);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, go]);

  return (
    <>
      <div className={styles.shots}>
        {shots.map((id, i) => (
          <button key={id} className={styles.shotBtn} onClick={() => setOpen(i)} aria-label={`Open screenshot ${i + 1} of ${shots.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(id)} alt={`${title} screenshot ${i + 1}`} className={styles.shotImg} loading="lazy" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div className={styles.lightbox} onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label={`${title} screenshots`}>
          <button className={styles.lbClose} onClick={() => setOpen(null)} aria-label="Close">✕</button>
          <button className={styles.lbBtn} style={{ left: '16px' }} onClick={(e) => { e.stopPropagation(); go(-1); }} disabled={open === 0} aria-label="Previous screenshot">‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl(shots[open])} alt={`${title} screenshot ${open + 1}`} className={styles.lightImg} onClick={(e) => e.stopPropagation()} />
          <button className={styles.lbBtn} style={{ right: '16px' }} onClick={(e) => { e.stopPropagation(); go(1); }} disabled={open === shots.length - 1} aria-label="Next screenshot">›</button>
          <div className={styles.lbCount}>{open + 1} / {shots.length}</div>
        </div>
      )}
    </>
  );
}
