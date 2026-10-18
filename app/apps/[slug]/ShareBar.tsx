'use client';

import { useEffect, useState } from 'react';
import styles from '../apps.module.css';

// Share an app listing: the phone's own share sheet where available, plus
// WhatsApp, Facebook and copy-link buttons that work everywhere.
export default function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  // Only known in the browser, so it's checked after the first render to
  // keep the server and client HTML identical.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => { setCanNativeShare(typeof navigator.share === 'function'); }, []);
  const text = title + ' on Khabar Apps';

  async function nativeShare() {
    try { await navigator.share({ title, text, url }); } catch {}
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  return (
    <div className={styles.share}>
      <span className={styles.shareLabel}>Share</span>
      {canNativeShare && <button type="button" onClick={nativeShare} className={styles.shareBtn}>Share…</button>}
      <a className={styles.shareBtn} href={'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a className={styles.shareBtn} href={'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url)} target="_blank" rel="noopener noreferrer">Facebook</a>
      <button type="button" onClick={copy} className={styles.shareBtn}>{copied ? 'Link copied' : 'Copy link'}</button>
    </div>
  );
}
