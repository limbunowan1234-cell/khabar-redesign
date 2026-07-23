'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
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

function getInitial(name: string): string {
  if (!name || name.length === 0) return 'U';
  return name.trim().charAt(0).toUpperCase();
}

function getMedal(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return String(rank) + 'th';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#c41e3a', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Writers</h3>
      {creators.map((creator, i) => {
        const score = creator.views;
        const tier = getTier(score);
        return (
          <Link key={creator.submitterId} href={'/profile/' + creator.submitterId} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', gap: '10px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '10px', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', border: '1px solid #f0f0f0' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.borderColor = '#c41e3a'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#f9f9f9'; e.currentTarget.style.borderColor = '#f0f0f0'; }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', overflow: 'hidden', flexShrink: 0 }}>
                  {creator.submitterAvatar ? (
                    <img src={creator.submitterAvatar} alt={creator.submitterName || 'Writer'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    getInitial(creator.submitterName)
                  )}
                </div>
                <span style={{ position: 'absolute', bottom: '-4px', right: '-6px', fontSize: '8px', fontWeight: '800', backgroundColor: tier.color, color: '#fff', padding: '1px 4px', borderRadius: '6px' }}>{getMedal(i + 1)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creator.submitterName || 'Writer'}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>{creator.views.toLocaleString()} views - {creator.articles} articles</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
