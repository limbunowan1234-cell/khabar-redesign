'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

const TIERS = [
  { name: 'New Writer', min: 0, max: 50, color: '#888' },
  { name: 'Bronze', min: 50, max: 500, color: '#CD7F32' },
  { name: 'Silver', min: 500, max: 2500, color: '#C0C0C0' },
  { name: 'Gold', min: 2500, max: Infinity, color: '#FFD700' },
];

function getTier(score: number) {
  return TIERS.find((t) => score >= t.min && score < t.max) || TIERS[0];
}

export default function TopCreators() {
  const [creators, setCreators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'limit', values: [500] })),
          { headers: H, credentials: 'include' }
        );
        if (!res.ok) return;
        const data = await res.json();
        const articles = data.documents || [];

        const creatorMap = new Map();
        for (const a of articles) {
          if (!a.submitterId || a.status !== 'published') continue;
          const key = a.submitterId;
          const existing = creatorMap.get(key) || { submitterId: a.submitterId, submitterName: a.submitterName, submitterAvatar: a.submitterAvatar, views: 0, articles: 0 };
          existing.views += a.views || 0;
          existing.articles += 1;
          creatorMap.set(key, existing);
        }

        const sorted = Array.from(creatorMap.values())
          .sort((a, b) => b.views - a.views)
          .slice(0, 10);

        setCreators(sorted);
      } catch (err) {
        console.error('TopCreators load error:', err);
      }
      setLoading(false);
    })();
  }, []);

  if (loading || creators.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#c41e3a', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔥 Top Creators</h3>
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory', paddingBottom: '4px' }}>
        {creators.map((creator, i) => {
          const score = creator.views;
          const tier = getTier(score);
          return (
            <Link key={creator.submitterId} href={'/profile/' + creator.submitterId} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '10px', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #f0f0f0', minWidth: '110px', flexShrink: 0, textAlign: 'center', scrollSnapAlign: 'start' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.borderColor = '#c41e3a'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#f9f9f9'; e.currentTarget.style.borderColor = '#f0f0f0'; }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', overflow: 'hidden' }}>
                    {creator.submitterAvatar ? <img src={creator.submitterAvatar} alt={creator.submitterName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : creator.submitterName?.[0].toUpperCase()}
                  </div>
                  <span style={{ position: 'absolute', bottom: '-4px', right: '-4px', fontSize: '12px' }}>{i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : i + 1 === 3 ? '🥉' : '⭐'}</span>
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '12px', color: '#1a1a1a', marginBottom: '3px' }}>{creator.submitterName}</div>
                  <span style={{ fontSize: '8px', fontWeight: '700', color: '#fff', background: tier.color, padding: '2px 6px', borderRadius: '8px', display: 'inline-block' }}>{tier.name}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>👁 {(creator.views / 1000).toFixed(1)}k</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}