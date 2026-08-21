'use client';
import { useState, useEffect } from 'react';

// Week 8 of the Cloudflare migration (see cloudflare/README.md): articles,
// likes, and comments all read from the Worker now.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// ---- Badge tier logic (combined score = views + likes + comments) ----
function getTier(score: number) {
  if (score >= 2500) return { key: 'gold', label: 'Star Journalist', emoji: '🥇', color: '#7a5c00', bg: 'linear-gradient(135deg,#fff3c4,#f5c518)', border: '#e0ac00' };
  if (score >= 500) return { key: 'silver', label: 'Reporter', emoji: '🥈', color: '#4a4a4a', bg: 'linear-gradient(135deg,#f0f0f0,#cfcfcf)', border: '#b0b0b0' };
  if (score >= 50) return { key: 'bronze', label: 'Contributor', emoji: '🥉', color: '#6b3d1f', bg: 'linear-gradient(135deg,#f5d9bf,#d99b6c)', border: '#c07a44' };
  return { key: 'new', label: 'New Writer', emoji: '✍️', color: '#666', bg: '#eee', border: '#ddd' };
}

// Fetch an author's aggregate stats across all their published articles.
// Returns combined score plus the breakdown for the tooltip.
export async function getAuthorStats(submitterId: string) {
  const empty = { articleCount: 0, totalViews: 0, totalLikes: 0, totalComments: 0, score: 0 };
  if (!submitterId) return empty;
  try {
    // 1) Author's articles (views live here, reliably)
    const aRes = await fetch(WORKER_URL + '/articles?submitterId=' + encodeURIComponent(submitterId) + '&limit=500');
    if (!aRes.ok) return empty;
    const aData = await aRes.json();
    const articles = aData.documents || [];
    const articleIds = articles.map((a: any) => a.$id).slice(0, 100); // cap for query-length safety
    const totalViews = articles.reduce((s: number, a: any) => s + (a.views || 0), 0);
    if (articleIds.length === 0) return { ...empty, articleCount: articles.length, totalViews, score: totalViews };

    // 2) Likes across those articles (one IN query) -- the Worker already
    // excludes comment likes for this shape (articleIds implies article-
    // level only, matching getArticleLikes() elsewhere).
    let totalLikes = 0;
    const lRes = await fetch(WORKER_URL + '/likes?articleIds=' + articleIds.map(encodeURIComponent).join(','));
    if (lRes.ok) {
      const lData = await lRes.json();
      totalLikes = (lData.documents || []).length;
    }

    // 3) Comments across those articles (one IN query)
    let totalComments = 0;
    const cRes = await fetch(WORKER_URL + '/comments?articleIds=' + articleIds.map(encodeURIComponent).join(','));
    if (cRes.ok) {
      const cData = await cRes.json();
      totalComments = (cData.documents || []).length;
    }

    const score = totalViews + totalLikes + totalComments;
    return { articleCount: articles.length, totalViews, totalLikes, totalComments, score };
  } catch {
    return empty;
  }
}

interface AuthorBadgeProps {
  submitterId: string;
  size?: 'sm' | 'md';        // sm for inline next to author name, md for profile header
  precomputedScore?: number; // optional: skip fetching if parent already has a score
  showLabel?: boolean;       // show the tier text label (default true)
}

export default function AuthorBadge({ submitterId, size = 'sm', precomputedScore, showLabel = true }: AuthorBadgeProps) {
  const [stats, setStats] = useState<any>(precomputedScore != null ? { score: precomputedScore } : null);
  const [loading, setLoading] = useState(precomputedScore == null);

  useEffect(() => {
    let alive = true;
    if (precomputedScore != null) { setStats({ score: precomputedScore }); setLoading(false); return; }
    setLoading(true);
    getAuthorStats(submitterId).then((s) => { if (alive) { setStats(s); setLoading(false); } });
    return () => { alive = false; };
  }, [submitterId, precomputedScore]);

  if (loading || !stats) return null;

  const tier = getTier(stats.score || 0);
  const isSm = size === 'sm';
  const tip = stats.totalViews != null
    ? tier.label + ' — ' + (stats.score || 0).toLocaleString() + ' pts (' + (stats.totalViews || 0) + ' views, ' + (stats.totalLikes || 0) + ' likes, ' + (stats.totalComments || 0) + ' comments)'
    : tier.label;

  return (
    <span
      title={tip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '3px' : '5px',
        padding: isSm ? '2px 8px' : '5px 12px',
        borderRadius: '20px',
        background: tier.bg,
        border: '1px solid ' + tier.border,
        boxShadow: '0 2px 6px ' + tier.border + '55, inset 0 1px 0 rgba(255,255,255,0.5)',
        fontSize: isSm ? '10px' : '13px',
        fontWeight: 700,
        color: tier.color,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        cursor: 'default',
      }}
    >
      <span style={{ fontSize: isSm ? '11px' : '15px' }}>{tier.emoji}</span>
      {showLabel && <span>{tier.label}</span>}
    </span>
  );
}
