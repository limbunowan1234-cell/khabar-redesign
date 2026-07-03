'use client';
import { useState, useEffect } from 'react';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

const TIERS = [
  { name: '✍️ New Writer', min: 0, max: 50, color: '#888' },
  { name: '🥉 Bronze', min: 50, max: 500, color: '#CD7F32' },
  { name: '🥈 Silver', min: 500, max: 2500, color: '#C0C0C0' },
  { name: '🥇 Gold', min: 2500, max: Infinity, color: '#FFD700' }
];

export default function TierProgress({ userId }: { userId: string }) {
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [userId] }));
        const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [1000] }));
        const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q1 + '&queries[]=' + q2, { headers: H, credentials: 'include' });
        if (!res.ok) throw new Error('articles');
        const articlesData = await res.json();
        const articleIds = (articlesData.documents || []).map((a: any) => a.$id);
        if (articleIds.length === 0) { if (alive) { setScore(0); setLoading(false); } return; }

        const q3 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
        const q4 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [1000] }));
        const likesRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' + q3 + '&queries[]=' + q4, { headers: H, credentials: 'include' });
        const likesData = likesRes.ok ? await likesRes.json() : { documents: [] };
        const userLikes = likesData.documents.filter((l: any) => articleIds.includes(l.articleId)).length;

        const commentsRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents?queries[]=' + q3 + '&queries[]=' + q4, { headers: H, credentials: 'include' });
        const commentsData = commentsRes.ok ? await commentsRes.json() : { documents: [] };
        const userComments = commentsData.documents.filter((c: any) => articleIds.includes(c.articleId)).length;

        const views = (articlesData.documents || []).reduce((sum: number, a: any) => sum + (a.views || 0), 0);
        const totalScore = views + userLikes + userComments;
        if (alive) setScore(totalScore);
      } catch {}
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  const currentTier = TIERS.find(t => score >= t.min && score < t.max) || TIERS[0];
  const nextTier = TIERS.find(t => score < t.min) || TIERS[TIERS.length - 1];
  const pointsToNext = nextTier.min - score;
  const progressPercent = nextTier === currentTier ? 100 : ((score - currentTier.min) / (nextTier.min - currentTier.min)) * 100;

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(196,30,58,0.1) 0%, rgba(245,197,24,0.05) 100%)', borderRadius: '14px', padding: '18px', marginBottom: '20px', border: '1px solid rgba(196,30,58,0.2)' }}>
      <div style={{ fontSize: '13px', fontWeight: '700', color: '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Your Tier Progress</div>
      {loading ? (
        <div style={{ height: '40px', background: '#ddd', borderRadius: '8px', animation: 'pulse 1.5s infinite' }} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#1a1a1a' }}>{currentTier.name}</div>
            <div style={{ fontSize: '14px', color: '#666' }}>{score} pts</div>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ width: progressPercent + '%', height: '100%', background: currentTier.color, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {pointsToNext === 0 ? '🎉 Max tier reached!' : `${pointsToNext} points to ${nextTier.name}`}
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '10px', lineHeight: '1.4' }}>
            New Writer: 0–50 | Bronze: 50–500 | Silver: 500–2,500 | Gold: 2,500+
          </div>
        </>
      )}
    </div>
  );
}
