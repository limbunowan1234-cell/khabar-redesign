'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';

// "New in the app" banner for the home page, announcing app 1.4.0
// (Flash News). Readers can close it; it stays closed for this version.
// Inside the Android app the "Get the app" button is hidden, since the
// reader already has it.

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.khabardarjeeling.app';
const VERSION = '1.4.0';
const KEY = 'kdAppBannerClosed';
const noop = () => () => {};

export default function AppUpdateBanner({ isMobile }: { isMobile: boolean }) {
  // Reads browser-only state after hydration, so server and client agree.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [closedNow, setClosedNow] = useState(false);

  let closed = closedNow;
  try { closed = closed || (mounted && localStorage.getItem(KEY) === VERSION); } catch {}
  const show = mounted && !closed;
  const inApp = mounted && (
    document.referrer.startsWith('android-app://') ||
    window.matchMedia('(display-mode: standalone)').matches
  );

  if (!show) return null;

  const close = () => {
    try { localStorage.setItem(KEY, VERSION); } catch {}
    setClosedNow(true);
  };

  return (
    <div style={{ padding: isMobile ? '12px 12px 0' : '16px 20px 0', maxWidth: '1280px', margin: '0 auto' }}>
      <style>{css}</style>
      <div className="kd-appbanner">
        <svg className="kd-appbanner-hills" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 120 L0 78 L70 40 L120 66 L190 18 L260 70 L330 34 L400 74 L470 28 L540 62 L600 44 L600 120 Z" fill="rgba(255,255,255,0.08)" />
          <path d="M0 120 L0 96 L90 64 L160 90 L240 54 L320 92 L410 60 L500 94 L600 70 L600 120 Z" fill="rgba(0,0,0,0.18)" />
        </svg>
        <div className="kd-appbanner-bolt" aria-hidden="true">⚡</div>
        <div className="kd-appbanner-text">
          <div className="kd-appbanner-kicker">New in the app · v{VERSION}</div>
          <div className="kd-appbanner-title">Flash News is here</div>
          <div className="kd-appbanner-sub">Seen something happening in the hills? Post a photo and a few lines. Like stories, edit your comments and get your own @username.</div>
        </div>
        <div className="kd-appbanner-actions">
          <Link href="/flash" className="kd-btn kd-btn-light">See Flash News</Link>
          {!inApp && <a href={PLAY_URL} target="_blank" rel="noopener noreferrer" className="kd-btn kd-btn-gold">Get the app</a>}
        </div>
        <button onClick={close} className="kd-appbanner-close" aria-label="Close">×</button>
      </div>
    </div>
  );
}

const css = `
.kd-appbanner{position:relative;overflow:hidden;display:flex;align-items:center;gap:18px;padding:18px 48px 18px 20px;border-radius:14px;color:#fff;background:linear-gradient(120deg,#c41e3a 0%,#8f1428 60%,#5e0d1a 100%);box-shadow:0 6px 20px rgba(196,30,58,.25);font-family:var(--font-sans,system-ui,sans-serif)}
.kd-appbanner-hills{position:absolute;left:0;right:0;bottom:0;width:100%;height:60%;pointer-events:none}
.kd-appbanner-bolt{position:relative;flex-shrink:0;width:56px;height:56px;border-radius:16px;background:#f5c518;display:flex;align-items:center;justify-content:center;font-size:30px;box-shadow:0 4px 12px rgba(0,0,0,.25)}
.kd-appbanner-text{position:relative;flex:1;min-width:0}
.kd-appbanner-kicker{font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:#f5c518}
.kd-appbanner-title{font-size:22px;font-weight:800;line-height:1.2;margin:2px 0 4px}
.kd-appbanner-sub{font-size:13.5px;line-height:1.45;color:rgba(255,255,255,.88);max-width:62ch}
.kd-appbanner-actions{position:relative;display:flex;gap:10px;flex-shrink:0}
.kd-btn{display:inline-block;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:800;text-decoration:none;white-space:nowrap}
.kd-btn-light{background:#fff;color:#c41e3a}
.kd-btn-gold{background:#f5c518;color:#1a1a1a}
.kd-appbanner-close{position:absolute;top:8px;right:10px;width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font-size:20px;line-height:1;cursor:pointer}
@media (max-width:767px){
.kd-appbanner{flex-wrap:wrap;gap:12px;padding:16px 44px 16px 16px}
.kd-appbanner-bolt{width:44px;height:44px;font-size:24px;border-radius:12px}
.kd-appbanner-text{flex:1 1 calc(100% - 60px)}
.kd-appbanner-title{font-size:18px}
.kd-appbanner-actions{width:100%}
.kd-btn{flex:1;text-align:center}
}
`;
