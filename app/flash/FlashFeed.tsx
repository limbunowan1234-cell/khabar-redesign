'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { appLink } from '@/lib/appLink';
import { useAuthStore } from '@/lib/authStore';

// Flash News as a full-screen, swipe-up photo feed (like Shorts, but
// photos). One post fills the screen; swipe, scroll, or use the arrow keys
// to move between posts. On wide screens the feed sits in a phone-shaped
// column in the middle.

const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SITE = 'https://khabardarjeeling.in';

export type Flash = {
  $id: string;
  slug: string | null;
  title: string;
  content: string | null;
  imageFileId: string | null;
  locationArea: string | null;
  locationDistrict: string | null;
  isBreaking: boolean;
  publishedAt: string | null;
  $createdAt: string;
  authorName: string | null;
  submitterName: string | null;
  byStaff?: boolean;
  likeCount?: number;
  commentCount?: number;
};

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Icon({ d }: { d: string }) {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
}
const HEART = 'M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3.1 4.5 6.7 4.5c2 0 3.6 1.1 4.3 2.6h2c.7-1.5 2.3-2.6 4.3-2.6 3.6 0 5.8 3.7 4.3 7.2C19.5 16.4 12 21 12 21z';
const COMMENT = 'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z';
const SHARE = 'M14 4l7 7-7 7v-4.1C8.5 13.9 5 15.6 3 20c.8-6 4-10.6 11-11.6V4z';

export default function FlashFeed({ items }: { items: Flash[] }) {
  const feed = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // Reporters and admins can post Flash from the website's Reporter panel
  // (Story / Flash News switch); everyone else is sent to the app.
  const user = useAuthStore((st) => st.user);
  const canPostHere = !!user && (user.labels?.includes('reporter') || user.labels?.includes('admin') || user.email === 'nowanad@gmail.com');
  const postLink = canPostHere
    ? { href: '/reporter/post' }
    : { href: appLink(), target: '_blank', rel: 'noopener noreferrer' };

  // Track which post is on screen (for the progress dots).
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollTop / el.clientHeight));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Arrow keys / J-K move one post at a time on desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = feed.current;
      if (!el) return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); el.scrollBy({ top: el.clientHeight, behavior: 'smooth' }); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); el.scrollBy({ top: -el.clientHeight, behavior: 'smooth' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const share = async (f: Flash) => {
    const url = SITE + '/article/' + (f.slug || f.$id);
    try {
      if (navigator.share) { await navigator.share({ title: f.title, url }); return; }
    } catch { return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(f.title + ' ' + url), '_blank', 'noopener');
  };

  return (
    <div className="ff-page">
      <style>{css}</style>
      <div className="ff-phone">
        <header className="ff-top">
          <Link href="/" className="ff-back" aria-label="Back to home">‹</Link>
          <span className="ff-title">⚡ Flash News</span>
          <a {...postLink} className="ff-post">+ Flash</a>
        </header>

        {items.length === 0 ? (
          <div className="ff-empty">
            <div className="ff-empty-bolt">⚡</div>
            <h1>No Flash News yet</h1>
            <p>Seen something happening in the hills? Post a photo and a few lines from the Khabar Darjeeling app.</p>
            <a {...postLink} className="ff-empty-btn">{canPostHere ? 'Post Flash News' : 'Get the app'}</a>
          </div>
        ) : (
          <>
            <div className="ff-feed" ref={feed}>
              {items.map((f, i) => {
                const img = f.imageFileId ? WORKER_URL + '/cdn/articles/' + f.imageFileId : '';
                const place = f.locationArea || f.locationDistrict;
                const by = f.authorName || f.submitterName || 'Khabar Darjeeling';
                const href = '/article/' + (f.slug || f.$id);
                return (
                  <section key={f.$id} className="ff-slide" aria-label={f.title}>
                    {img && (
                      <>
                        {/* Blurred copy fills the frame; the sharp photo sits on top uncropped. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="" aria-hidden="true" className="ff-bg" loading={i < 2 ? 'eager' : 'lazy'} />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={f.title} className="ff-img" loading={i < 2 ? 'eager' : 'lazy'} />
                      </>
                    )}
                    <div className="ff-shade" />

                    <div className="ff-actions">
                      <Link href={href} className="ff-act" aria-label="Likes"><Icon d={HEART} /><span>{f.likeCount ?? 0}</span></Link>
                      <Link href={href + '#comments'} className="ff-act" aria-label="Comments"><Icon d={COMMENT} /><span>{f.commentCount ?? 0}</span></Link>
                      <button type="button" onClick={() => share(f)} className="ff-act" aria-label="Share"><Icon d={SHARE} /><span>Share</span></button>
                    </div>

                    <div className="ff-info">
                      <div className="ff-tags">
                        {f.isBreaking && <span className="ff-tag ff-tag-red">Breaking</span>}
                        <span className={'ff-tag ' + (f.byStaff ? 'ff-tag-teal' : 'ff-tag-gold')}>{f.byStaff ? 'Khabar Darjeeling' : 'Community'}</span>
                      </div>
                      <div className="ff-by">{by} · {timeAgo(f.publishedAt || f.$createdAt)}</div>
                      <Link href={href} className="ff-headline">{f.title}</Link>
                      {f.content && <p className="ff-text">{f.content}</p>}
                      {place && <div className="ff-place">📍 {place}</div>}
                    </div>
                  </section>
                );
              })}
            </div>
            {items.length > 1 && (
              <div className="ff-dots" aria-hidden="true">
                {items.slice(0, 12).map((f, i) => <i key={f.$id} className={i === Math.min(index, 11) ? 'on' : ''} />)}
              </div>
            )}
            {index === 0 && items.length > 1 && <div className="ff-hint" aria-hidden="true">Swipe up ↑</div>}
          </>
        )}
      </div>
    </div>
  );
}

const css = `
.ff-page{position:fixed;inset:0;background:#0b0b0b;display:flex;justify-content:center;font-family:var(--font-sans,system-ui,sans-serif);color:#fff}
.ff-phone{position:relative;width:100%;height:100%;max-width:calc(100dvh * 9 / 16);background:#000;overflow:hidden}
@media (min-width:700px){.ff-phone{max-width:min(460px,calc(100dvh * 9 / 16));box-shadow:0 0 0 1px #222,0 20px 60px rgba(0,0,0,.6)}}
.ff-top{position:absolute;z-index:5;top:0;left:0;right:0;display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(rgba(0,0,0,.55),transparent)}
.ff-back{color:#fff;text-decoration:none;font-size:34px;line-height:1;width:32px}
.ff-title{flex:1;font-weight:800;font-size:17px;text-shadow:0 1px 4px rgba(0,0,0,.5)}
.ff-post{background:#c41e3a;color:#fff;text-decoration:none;font-weight:800;font-size:13px;padding:7px 14px;border-radius:999px}
.ff-feed{height:100%;overflow-y:auto;scroll-snap-type:y mandatory;overscroll-behavior:contain;scrollbar-width:none}
.ff-feed::-webkit-scrollbar{display:none}
.ff-slide{position:relative;height:100%;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;background:#111}
.ff-bg{position:absolute;inset:-20px;width:calc(100% + 40px);height:calc(100% + 40px);object-fit:cover;filter:blur(24px) brightness(.55)}
.ff-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
.ff-shade{position:absolute;inset:0;background:linear-gradient(transparent 50%,rgba(0,0,0,.85));pointer-events:none}
.ff-actions{position:absolute;z-index:3;right:10px;bottom:120px;display:flex;flex-direction:column;gap:18px;align-items:center}
.ff-act{display:flex;flex-direction:column;align-items:center;gap:3px;color:#fff;text-decoration:none;background:none;border:0;cursor:pointer;font:inherit;font-size:12px;font-weight:700;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))}
.ff-info{position:absolute;z-index:3;left:14px;right:70px;bottom:22px;display:flex;flex-direction:column;gap:6px}
.ff-tags{display:flex;gap:6px}
.ff-tag{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.4px}
.ff-tag-red{background:#c41e3a}.ff-tag-gold{background:#f5c518;color:#1a1a1a}.ff-tag-teal{background:#0f4c5c}
.ff-by{font-size:13px;font-weight:700;opacity:.9}
.ff-headline{color:#fff;text-decoration:none;font-size:19px;font-weight:800;line-height:1.25;text-shadow:0 1px 6px rgba(0,0,0,.5)}
.ff-text{margin:0;font-size:14px;line-height:1.45;opacity:.92;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.ff-place{font-size:13px;opacity:.9}
.ff-dots{position:absolute;z-index:4;right:4px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:5px}
.ff-dots i{width:4px;height:4px;border-radius:2px;background:rgba(255,255,255,.4)}
.ff-dots i.on{height:14px;background:#f5c518}
.ff-hint{position:absolute;z-index:4;left:50%;top:64px;transform:translateX(-50%);background:rgba(0,0,0,.6);padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;pointer-events:none;animation:ffHint 1.6s ease-in-out 3,ffFade .4s ease 4.8s forwards}
@keyframes ffHint{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-6px)}}
@keyframes ffFade{to{opacity:0}}
.ff-empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 32px;gap:10px;background:radial-gradient(circle at 50% 40%,#3a0a14,#000 70%)}
.ff-empty-bolt{font-size:56px}
.ff-empty h1{margin:0;font-size:22px;font-weight:800}
.ff-empty p{margin:0;font-size:15px;line-height:1.5;opacity:.85}
.ff-empty-btn{margin-top:8px;background:#c41e3a;color:#fff;text-decoration:none;font-weight:800;padding:12px 26px;border-radius:999px}
@media (prefers-reduced-motion:reduce){.ff-hint{animation:none}}
`;
