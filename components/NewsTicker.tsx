'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Home-page news banner. It used to appear only when a story was marked
// breaking, so on most days it was missing. Now it always runs:
// breaking stories first, then the newest Flash News, then the latest
// headlines. Flash posts are kind = 'flash' and are left out of the normal
// /articles list, so they are fetched separately here.

const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

type Article = { $id: string; slug?: string | null; title?: string; isBreaking?: boolean };
type Item = { id: string; href: string; title: string; type: 'breaking' | 'flash' | 'latest' };

function toItem(a: Article, type: Item['type']): Item {
  return { id: type + ':' + a.$id, href: '/article/' + (a.slug || a.$id), title: a.title || '', type };
}

export default function NewsTicker({ articles }: { articles: Article[] }) {
  const [flash, setFlash] = useState<Article[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(WORKER_URL + '/articles?kind=flash&limit=8')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.documents) setFlash(d.documents); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const breaking = articles.filter((a) => a.isBreaking).slice(0, 6);
  const seen = new Set(breaking.map((a) => a.$id));
  const latest = articles.filter((a) => !seen.has(a.$id)).slice(0, 8);
  const items: Item[] = [
    ...breaking.map((a) => toItem(a, 'breaking')),
    ...flash.filter((a) => a.title).map((a) => toItem(a, 'flash')),
    ...latest.map((a) => toItem(a, 'latest')),
  ].filter((i) => i.title);

  if (items.length === 0) return null;
  const label = breaking.length > 0 ? 'Breaking' : 'Latest';
  // About 4.5s per headline keeps it readable however many there are.
  const duration = Math.max(30, items.length * 4.5);

  return (
    <div className="kd-ticker" role="region" aria-label={label + ' news'}>
      <style>{css}</style>
      <div className="kd-ticker-label">
        <span className="kd-ticker-dot" aria-hidden="true" />
        {label}
      </div>
      <div className="kd-ticker-wrap">
        <div className="kd-ticker-track" style={{ animationDuration: duration + 's' }}>
          {[0, 1].map((copy) => (
            <div key={copy} className="kd-ticker-set" aria-hidden={copy === 1 ? 'true' : undefined}>
              {items.map((i) => (
                <Link key={i.id + copy} href={i.href} className="kd-ticker-item" tabIndex={copy === 1 ? -1 : undefined}>
                  {i.type === 'flash' && <span className="kd-tag kd-tag-flash">⚡ Flash</span>}
                  {i.type === 'breaking' && <span className="kd-tag kd-tag-breaking">Breaking</span>}
                  {i.title}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Link href="/flash" className="kd-ticker-more">⚡ Flash News</Link>
    </div>
  );
}

const css = `
.kd-ticker{display:flex;align-items:stretch;background:#111;color:#fff;border-bottom:3px solid #f5c518;overflow:hidden;font-family:var(--font-sans,system-ui,sans-serif)}
.kd-ticker-label{flex-shrink:0;display:flex;align-items:center;gap:8px;background:#c41e3a;padding:0 16px;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap;position:relative}
.kd-ticker-label:after{content:"";position:absolute;right:-10px;top:0;bottom:0;width:10px;background:#c41e3a;clip-path:polygon(0 0,100% 50%,0 100%)}
.kd-ticker-dot{width:8px;height:8px;border-radius:50%;background:#fff;animation:kdPulse 1.4s ease-in-out infinite}
.kd-ticker-wrap{flex:1;min-width:0;overflow:hidden;padding-left:14px}
.kd-ticker-track{display:inline-flex;white-space:nowrap;animation:kdTicker linear infinite}
.kd-ticker:hover .kd-ticker-track,.kd-ticker:focus-within .kd-ticker-track{animation-play-state:paused}
.kd-ticker-set{display:inline-flex}
.kd-ticker-item{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;padding:10px 22px 10px 0;font-size:13px;font-weight:500}
.kd-ticker-item:before{content:"";width:5px;height:5px;border-radius:50%;background:#f5c518;margin-right:6px;flex-shrink:0}
.kd-ticker-item:hover{text-decoration:underline}
.kd-tag{font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;padding:2px 7px;border-radius:999px}
.kd-tag-flash{background:#f5c518;color:#1a1a1a}
.kd-tag-breaking{background:#c41e3a;color:#fff}
.kd-ticker-more{flex-shrink:0;display:flex;align-items:center;background:#f5c518;color:#1a1a1a;font-size:12px;font-weight:800;padding:0 14px;text-decoration:none;white-space:nowrap}
@keyframes kdTicker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes kdPulse{0%,100%{opacity:1}50%{opacity:.25}}
@media (max-width:640px){.kd-ticker-more{display:none}.kd-ticker-label{padding:0 12px}}
@media (prefers-reduced-motion:reduce){.kd-ticker-track{animation:none}.kd-ticker-wrap{overflow-x:auto}.kd-ticker-dot{animation:none}}
`;
