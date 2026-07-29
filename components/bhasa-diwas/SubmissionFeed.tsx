'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';
import Link from 'next/link';

const CATS: Record<string, { label: string; bg: string }> = {
  poetry: { label: '✍️ काव्य', bg: '#f3e8ff' },
  essay: { label: '📚 निबन्ध', bg: '#dbeafe' },
  photo: { label: '📷 फोटो', bg: '#dcfce7' }
};

const S = {
  filterBar: { display: 'flex', flexWrap: 'wrap' as const, gap: '10px', marginBottom: '24px' },
  emptyBox: { background: 'white', borderRadius: '8px', padding: '48px', textAlign: 'center' as const },
  card: { background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '20px', borderLeft: '4px solid #b91c1c' },
  cardHeader: { padding: '20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '14px' },
  avatar: { width: '44px', height: '44px', borderRadius: '50%', background: '#b91c1c', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px' },
  cardBody: { padding: '20px' },
  cardTitle: { fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 12px' },
  cardText: { color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const },
  cardFooter: { padding: '16px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb' },
  photoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' },
  photoTile: { position: 'relative' as const, borderRadius: '10px', overflow: 'hidden', aspectRatio: '1', background: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  photoOverlay: { position: 'absolute' as const, bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)', padding: '20px 12px 10px', color: 'white' },
  photoTitle: { fontSize: '13px', fontWeight: 700, margin: '0 0 2px', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const },
  photoMeta: { fontSize: '11px', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '6px' }
};

function filterBtn(active: boolean) {
  return {
    padding: '8px 16px', borderRadius: '20px', fontWeight: 600, cursor: 'pointer',
    background: active ? '#b91c1c' : 'white', color: active ? 'white' : '#374151',
    border: active ? '2px solid #b91c1c' : '2px solid #d1d5db'
  };
}

function voteBtn(voted: boolean) {
  return { background: 'none', border: 'none', fontWeight: 600, cursor: voted ? 'default' : 'pointer', color: voted ? '#b91c1c' : '#6b7280', fontSize: '15px' };
}

export default function SubmissionFeed({ refreshTrigger }: { refreshTrigger: number }) {
  const { user, isAuthenticated } = useAuthStore();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userVotes, setUserVotes] = useState(new Set());

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await fetch('/api/bhasa-diwas/submissions?category=' + selectedCategory);
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setUserVotes(new Set(data.userVotes || []));
      } catch (error) {
        console.error('Failed to fetch submissions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [refreshTrigger, selectedCategory]);

  const handleVote = async (submissionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated || !user) { alert('कृपया मत दिन लगिन गर्नुहोस्।'); return; }
    try {
      const res = await fetch('/api/bhasa-diwas/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, userId: user.$id })
      });
      const data = await res.json();
      if (data.success) {
        setUserVotes(prev => new Set([...prev, submissionId]));
        setSubmissions(submissions.map(s => s.$id === submissionId ? { ...s, votes: s.votes + 1 } : s));
      } else if (data.error) { alert(data.error); }
    } catch (error) { console.error('Failed to vote:', error); }
  };

  const isPhotoView = selectedCategory === 'photo';

  if (loading) return <div style={{ textAlign: 'center', padding: '48px', fontSize: '20px' }}>लोड हो रहेको छ...</div>;

  return (
    <div>
      <div style={S.filterBar}>
        <button onClick={() => setSelectedCategory('all')} style={filterBtn(selectedCategory === 'all')}>सबै</button>
        {Object.entries(CATS).map(([key, cat]) => (
          <button key={key} onClick={() => setSelectedCategory(key)} style={filterBtn(selectedCategory === key)}>{cat.label}</button>
        ))}
      </div>

      {submissions.length === 0 ? (
        <div style={S.emptyBox}><p style={{ color: '#6b7280', fontSize: '18px' }}>अहिले कुनै सबमिशन छैन।</p></div>
      ) : isPhotoView ? (
        <div style={S.photoGrid}>
          {submissions.map(submission => (
            <Link key={submission.$id} href={'/nepali-bhasa-diwas/' + submission.$id} style={{ textDecoration: 'none' }}>
              <div style={S.photoTile}>
                {submission.imageFileId && (
                  <img
                    src={'/api/image-proxy?fileId=' + submission.imageFileId + '&bucket=6a67a307002f71e8dcf5'}
                    alt={submission.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <div style={S.photoOverlay}>
                  <p style={S.photoTitle}>{submission.title}</p>
                  <div style={S.photoMeta}>
                    <span>{submission.submitterName}</span>
                    <span>👍 {submission.votes || 0}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div>
          {submissions.map(submission => {
            const cat = CATS[submission.category];
            return (
              <Link key={submission.$id} href={'/nepali-bhasa-diwas/' + submission.$id} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <div style={S.avatar}>{submission.submitterName.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#111827' }}>{submission.submitterName}</div>
                      <div style={{ fontSize: '13px', color: '#9ca3af' }}>{new Date(submission.$createdAt).toLocaleDateString('ne-NP')}</div>
                    </div>
                    {cat && <div style={{ padding: '6px 14px', borderRadius: '20px', background: cat.bg, fontSize: '13px', fontWeight: 600 }}>{cat.label}</div>}
                  </div>
                  <div style={S.cardBody}>
                    <h3 style={S.cardTitle}>{submission.title}</h3>
                    <p style={S.cardText}>{submission.description}</p>
                  </div>
                  <div style={S.cardFooter}>
                    <button onClick={(e) => handleVote(submission.$id, e)} disabled={userVotes.has(submission.$id)} style={voteBtn(userVotes.has(submission.$id))}>
                      👍 {submission.votes || 0} मत
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
