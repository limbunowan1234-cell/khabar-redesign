'use client';

import { useEffect, useState } from 'react';
import { DOWNLOAD_CATEGORIES, categoryMeta, formatFileSize, type DownloadItem } from '@/lib/downloadCategories';

export default function AppsClient({ items, workerUrl }: { items: DownloadItem[]; workerUrl: string }) {
  const [active, setActive] = useState<string>('all');

  // Deep links like /apps#games open straight on that tab.
  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '');
    if (DOWNLOAD_CATEGORIES.some((c) => c.key === fromHash)) setActive(fromHash);
  }, []);

  function choose(key: string) {
    setActive(key);
    history.replaceState(null, '', key === 'all' ? window.location.pathname : '#' + key);
  }

  const visible = active === 'all' ? items : items.filter((i) => i.category === active);
  const countFor = (key: string) => (key === 'all' ? items.length : items.filter((i) => i.category === key).length);

  const tabs = [{ key: 'all', label: 'All', emoji: '' }, ...DOWNLOAD_CATEGORIES];

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => choose(t.key)}
              style={{
                padding: '8px 16px',
                borderRadius: '999px',
                border: '1px solid ' + (on ? '#c41e3a' : '#e5e7eb'),
                background: on ? '#c41e3a' : 'white',
                color: on ? 'white' : '#374151',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {t.emoji ? t.emoji + ' ' : ''}{t.label} <span style={{ opacity: 0.7, fontWeight: 600 }}>({countFor(t.key)})</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', padding: '48px 20px', textAlign: 'center', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          Nothing here yet &mdash; check back soon.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
          {visible.map((item) => {
            const cat = categoryMeta(item.category);
            const size = formatFileSize(item.sizeBytes);
            return (
              <div key={item.$id} style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {item.iconFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={workerUrl + '/cdn/articles/' + item.iconFileId} alt="" style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover', flexShrink: 0, background: '#f3f4f6' }} />
                  ) : (
                    <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', flexShrink: 0 }}>{cat.emoji}</div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: '#111827', lineHeight: 1.25, overflowWrap: 'anywhere' }}>{item.title}</div>
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ background: '#fef2f2', color: '#c41e3a', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>{cat.label}</span>
                      {item.version && <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>v{item.version.replace(/^v/i, '')}</span>}
                    </div>
                  </div>
                </div>

                {item.description && (
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: '#4b5563', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.description}
                  </p>
                )}

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {[size, item.downloadCount > 0 ? item.downloadCount.toLocaleString() + ' download' + (item.downloadCount === 1 ? '' : 's') : ''].filter(Boolean).join(' · ')}
                  </span>
                  <a
                    href={workerUrl + '/downloads/' + item.$id + '/download'}
                    rel="nofollow noopener"
                    target={item.hosted ? undefined : '_blank'}
                    style={{ background: '#c41e3a', color: 'white', padding: '9px 18px', borderRadius: '999px', fontWeight: 800, fontSize: '13px', textDecoration: 'none', whiteSpace: 'nowrap' }}
                  >
                    Download
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ margin: '28px 0 0', fontSize: '12px', color: '#9ca3af', maxWidth: '70ch' }}>
        Android may ask you to allow installs from your browser the first time you open an APK. Only install apps from sources you trust.
      </p>
    </>
  );
}
