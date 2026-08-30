'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const dbId = 'Khabar_db';
const ADMIN_EMAIL = 'nowanad@gmail.com';

const CATEGORY_LABELS: Record<string, string> = {
  poetry: 'Poetry',
  essay: 'Essay',
  photo: 'Photo'
};

export default function BhasaDiwasAdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [winners, setWinners] = useState<any[]>([]);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.email?.toLowerCase() !== ADMIN_EMAIL && !(data as any).labels?.includes('admin')) {
            setError('Access denied. Admin only.');
            setLoading(false);
            return;
          }
          setUser(data);
          await loadSubmissions();
          await loadWinners();
        } else {
          setError('Please log in.');
        }
      } catch {
        setError('Failed to load.');
      }
      setLoading(false);
    }
    load();
  }, []);

  async function loadSubmissions() {
    try {
      const res = await fetch('/api/bhasa-diwas/submissions?category=all');
      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Failed to load submissions:', err);
    }
  }
  async function loadWinners() {
    try {
      const res = await fetch('/api/bhasa-diwas/winners-full', { credentials: 'include' });
      const data = await res.json();
      setWinners(data.documents || []);
    } catch (err) {
      console.error('Failed to load winners:', err);
    }
  }

  async function handleFinalizeWinners() {
    if (!confirm('Lock in the top 3 poetry and essay entries as winners, based on current votes? This can be re-run later if needed (it always re-derives from current votes).')) return;
    setFinalizing(true);
    try {
      const res = await fetch('/api/bhasa-diwas/finalize-winners', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        await loadWinners();
      } else {
        alert('Failed to finalize winners');
      }
    } catch (err) {
      console.error('Finalize winners failed:', err);
      alert('Failed to finalize winners');
    } finally {
      setFinalizing(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm('Delete this submission: ' + title + '?')) return;
    setDeletingId(id);
    try {
      const res = await fetch('/api/bhasa-diwas/admin-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include'
      });
      if (res.ok) {
        setSubmissions(prev => prev.filter(s => s.$id !== id));
      } else {
        alert('Delete failed');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Delete failed');
    } finally {
      setDeletingId(null);
    }
  }
  const [togglingId, setTogglingId] = useState<string | null>(null);
  async function handleToggleFeature(id: string, currentValue: boolean) {
    setTogglingId(id);
    try {
      const res = await fetch('/api/bhasa-diwas/admin-feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isFeatured: !currentValue }),
        credentials: 'include'
      });
      if (res.ok) {
        setSubmissions(prev => prev.map(s => s.$id === id ? { ...s, isFeatured: !currentValue } : s));
      } else {
        alert('Failed to update');
      }
    } catch (err) {
      console.error('Toggle feature failed:', err);
      alert('Failed to update');
    } finally {
      setTogglingId(null);
    }
  }

  const filtered = filterCategory === 'all' ? submissions : submissions.filter(s => s.category === filterCategory);

  if (loading) return <div style={{ textAlign: 'center', padding: '80px' }}>Loading...</div>;
  if (error) return (
    <div style={{ textAlign: 'center', padding: '80px' }}>
      <p style={{ color: '#c41e3a', fontWeight: 700 }}>{error}</p>
      <Link href="/" style={{ color: '#c41e3a' }}>← Back to Home</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '30px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#b91c1c', margin: 0 }}>Nepali Bhasa Diwas - Moderation</h1>
          <Link href="/admin" style={{ color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>← Admin Panel</Link>
        </div>

        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '12px', marginBottom: winners.length > 0 ? '16px' : 0 }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>🏆 Winners (Poetry & Essay, Top 3 each)</h2>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                {winners.length === 0 ? 'Not finalized yet — winners are ranked by current votes.' : `${winners.length} winners locked in. Re-finalizing re-ranks from current votes.`}
              </p>
            </div>
            <button
              onClick={handleFinalizeWinners}
              disabled={finalizing}
              style={{ background: '#b91c1c', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: finalizing ? 0.6 : 1, whiteSpace: 'nowrap' as const }}
            >
              {finalizing ? 'Finalizing...' : winners.length === 0 ? 'Finalize Top 3' : 'Re-Finalize'}
            </button>
          </div>

          {winners.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
              {winners.map((w) => (
                <div key={w.$id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#f9fafb', borderRadius: '6px', flexWrap: 'wrap' as const }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>
                      #{w.winnerRank} · {CATEGORY_LABELS[w.category] || w.category} · {w.title} — {w.submitterName}
                    </div>
                    {w.addressSubmittedAt ? (
                      <div style={{ fontSize: '12px', color: '#065f46', marginTop: '4px' }}>
                        📦 {w.winnerFullName} · {w.winnerAddress} · {w.winnerPhone}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#b45309', marginTop: '4px' }}>⏳ Address not submitted yet</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' as const }}>
          {['all', 'poetry', 'essay', 'photo'].map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{
                padding: '8px 16px', borderRadius: '20px', fontWeight: 600, cursor: 'pointer',
                background: filterCategory === cat ? '#b91c1c' : 'white',
                color: filterCategory === cat ? 'white' : '#374151',
                border: filterCategory === cat ? '2px solid #b91c1c' : '2px solid #d1d5db'
              }}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>
          Total submissions: {filtered.length}
        </p>

        {filtered.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '8px', padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
            No submissions found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtered.map(sub => (
              <div key={sub.$id} style={{ background: 'white', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                      {CATEGORY_LABELS[sub.category] || sub.category}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{new Date(sub.$createdAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{sub.title}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>{sub.submitterName}</div>
                  <div style={{ fontSize: '13px', color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {sub.description}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>👍 {sub.votes || 0} votes</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '8px', flexShrink: 0 }}>
                  <Link href={'/nepali-bhasa-diwas/' + sub.$id} target="_blank" style={{ fontSize: '12px', color: '#2563eb', textDecoration: 'none', textAlign: 'center' as const }}>
                    View
                  </Link>
                  <button
                    onClick={() => handleToggleFeature(sub.$id, sub.isFeatured)}
                    disabled={togglingId === sub.$id}
                    style={{ background: sub.isFeatured ? '#fef3c7' : '#f3f4f6', color: sub.isFeatured ? '#92400e' : '#6b7280', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: togglingId === sub.$id ? 0.5 : 1 }}
                  >
                    {togglingId === sub.$id ? '...' : (sub.isFeatured ? '★ Featured' : 'Feature')}
                  </button>
                  <button
                    onClick={() => handleDelete(sub.$id, sub.title)}
                    disabled={deletingId === sub.$id}
                    style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: deletingId === sub.$id ? 0.5 : 1 }}
                  >
                    {deletingId === sub.$id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
