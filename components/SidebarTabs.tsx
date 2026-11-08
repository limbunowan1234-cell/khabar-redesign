'use client';
import { useState, ReactNode } from 'react';
import Link from 'next/link';

const TABS = ['Top 10', 'Breaking', 'Trending'];

export default function SidebarTabs({ articles, isDarkMode, topTen, breaking }: {
  articles: any[];
  isDarkMode?: boolean;
  topTen: ReactNode;
  breaking: ReactNode;
}) {
  const [tab, setTab] = useState('Top 10');

  const cardBg = isDarkMode ? '#1e1e1e' : '#ffffff';
  const textCol = isDarkMode ? '#fff' : '#1a1a1a';
  const subCol = isDarkMode ? '#888' : '#aaa';
  const border = isDarkMode ? '#2a2a2a' : '#f0f0f0';

  const trending = [...articles].sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).slice(0, 5);

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--rule)', marginBottom: '14px' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px 6px',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: tab === t ? '#c41e3a' : (isDarkMode ? '#aaa' : '#666'),
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: tab === t ? '3px solid #c41e3a' : '3px solid transparent',
              marginBottom: '-1px',
              borderRadius: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'color 0.15s, border-color 0.15s'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Breaking' && breaking}
      {tab === 'Top 10' && topTen}
      {tab === 'Trending' && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 800, color: textCol, textTransform: 'uppercase', letterSpacing: '1.2px', margin: '0 0 10px' }}>Trending Now</h3>
          {trending.map((a: any, i: number) => (
            <Link key={a.$id} href={'/article/' + (a.slug || a.$id)} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', gap: '10px', paddingBottom: '12px', marginBottom: '12px', borderBottom: i < trending.length - 1 ? '1px solid ' + border : 'none', cursor: 'pointer' }}>
                <div style={{ width: '22px', color: i < 3 ? '#c41e3a' : (isDarkMode ? '#888' : '#aaa'), fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 800, lineHeight: 1, flexShrink: 0, textAlign: 'center' }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isDarkMode ? '#ddd' : '#333', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</p>
                  <div style={{ fontSize: '11px', color: subCol, marginTop: '4px' }}>{a.views || 0} views</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
