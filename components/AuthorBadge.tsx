'use client';
import { useState, useEffect } from 'react';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

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
    const qa1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [submitterId] }));
    const qa2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [500] }));
    const aRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + qa1 + '&queries[]=' + qa2, { headers: H, credentials: 'include' });
    if (!aRes.ok) return empty;
    const aData = await aRes.json();
    const articles = (aData.documents || []).filter((a: any) => a.status === 'published' || !a.status);
    const articleIds = articles.map((a: any) => a.$id).slice(0, 100); // cap for query-length safety
    const totalViews = articles.reduce((s: number, a: any) => s + (a.views || 0), 0);
    if (articleIds.length === 0) return { ...empty, articleCount: articles.length, totalViews, score: totalViews };

    // 2) Likes across those articles (one IN query), exclude comment likes in JS
    let totalLikes = 0;
    const ql1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: articleIds }));
    const ql2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [5000] }));
    const lRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' + ql1 + '&queries[]=' + ql2, { headers: H, credentials: 'include' });
    if (lRes.ok) {
      const lData = await lRes.json();
      totalLikes = (lData.documents || []).filter((l: any) => !l.commentId).length;
    }

    // 3) Comments across those articles (one IN query)
    let totalComments = 0;
    const qc1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: articleIds }));
    const qc2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [5000] }));
    const cRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents?queries[]=' + qc1 + '&queries[]=' + qc2, { headers: H, credentials: 'include' });
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
