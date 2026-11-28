'use client';

import { useEffect, type ReactNode } from 'react';
import s from './Reunion.module.css';

// Modal used across the case workspace. Escape or a click outside closes it.
export default function Dialog({ title, children, footer, onClose }: { title: string; children: ReactNode; footer: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className={s.dialogTitle}>{title}</h2>
        <div className={s.form} style={{ marginTop: 12 }}>{children}</div>
        <div className={s.dialogActions}>{footer}</div>
      </div>
    </div>
  );
}
