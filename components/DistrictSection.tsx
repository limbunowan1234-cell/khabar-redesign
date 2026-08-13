'use client';

import Link from 'next/link';
import { useState } from 'react';
import StoryCard from './StoryCard';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DISTRICTS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];

function imgOf(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  if (!a?.imageFileId || ['Text', 'null', 'undefined', ''].includes(String(a.imageFileId))) return '';
  return ENDPOINT + '/storage/buckets/article-image/files/' + a.imageFileId + '/view?project=' + PROJECT;
}

function toStory(a: any) {
  return {
    $id: a.$id,
    slug: a.slug,
    title: a.title,
    imageUrl: imgOf(a),
    genre: a.genre || a.category || 'News',
    authorName: a.submitterName || a.authorName || 'Staff Reporter',
    publishedAt: a.publishedAt,
  };
}

export default function DistrictSection({ articles, defaultDistrict }: { articles: any[]; defaultDistrict?: string | null }) {
  const [active, setActive] = useState(defaultDistrict && DISTRICTS.includes(defaultDistrict) ? defaultDistrict : 'Darjeeling');

  const districtArticles = articles
    .filter((a: any) => (a.locationDistrict || a.location || '').toLowerCase() === active.toLowerCase())
    .slice(0, 4);

  if (articles.length === 0) return null;
  return (
    <div style={{ marginBottom: '32px', background: 'var(--color-surface)', borderRadius: '8px', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Regions</h2>
        <Link href={'/region/' + active.toLowerCase().replace(/\s+/g, '-')} style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>View all {active} &rarr;</Link>
      </div>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '22px', borderBottom: '2px solid var(--color-border)', overflowX: 'auto' as const, flexWrap: 'nowrap' as const }}>
        {DISTRICTS.map((d) => (
          <button
            key={d}
            onClick={() => setActive(d)}
            style={{
              padding: '10px 2px',
              border: 'none',
              borderBottom: active === d ? '3px solid var(--color-primary)' : '3px solid transparent',
              marginBottom: '-2px',
              background: 'transparent',
              color: active === d ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-sans)',
              fontSize: '16px',
              fontWeight: active === d ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {d}
          </button>
        ))}
      </div>
      {districtArticles.length === 0 ? (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-muted)' }}>No recent stories from {active} yet.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {districtArticles.map((a: any) => (
            <StoryCard key={a.$id} story={toStory(a)} variant="compact" />
          ))}
        </div>
      )}
    </div>
  );
}
