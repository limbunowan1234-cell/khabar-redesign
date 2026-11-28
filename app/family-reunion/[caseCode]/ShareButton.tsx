'use client';

import { useState } from 'react';
import s from '../Appeal.module.css';

// Native share sheet on phones; copies the link elsewhere.
export default function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* share cancelled or clipboard unavailable */ }
  };
  return <button type="button" className={s.ctaAlt} onClick={share}>{copied ? 'Link copied' : 'Share this appeal'}</button>;
}
