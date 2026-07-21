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
      <div style={{ display: 'flex', gap: '4px', backgroundColor: isDarkMode ? '#161616' : '#ececec', padding: '4px', borderRadius: '10px', marginBottom: '10px' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '8px 6px',
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              color: tab === t ? '#fff' : (isDarkMode ? '#aaa' : '#666'),
              backgroundColor: tab === t ? '#c41e3a' : 'transparent',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Breaking' && breaking}
      {tab === 'Top 10' && topTen}
      {tab === 'Trending' && (
        <div style={{ backgroundColor: cardBg, borderRadius: '10px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 800, color: textCol, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px', paddingBottom: '10px', borderBottom: '2px solid #f5c518' }}>Trending Now</h3>
          {trending.map((a: any, i: number) => (
            <Link key={a.$id} href={'/article/' + (a.slug || a.$id)} style={{ textDecoration: 'none' }}>
              <div style={{ display: 'flex', gap: '10px', paddingBottom: '12px', marginBottom: '12px', borderBottom: i < trending.length - 1 ? '1px solid ' + border : 'none', cursor: 'pointer' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#c41e3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
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
