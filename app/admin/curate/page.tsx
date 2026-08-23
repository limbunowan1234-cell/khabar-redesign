'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWorkerAuthToken } from '@/lib/appwrite';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const dbId = 'Khabar_db';
const bucketId = 'article-image';
const ADMIN_EMAIL = 'nowanad@gmail.com';
// Week 19+22 of the Cloudflare migration (see cloudflare/README.md): the
// article list below reads from the Worker's public /articles route
// (published-only by default -- curation only ever applies to published
// content anyway, so no auth needed here unlike the admin dashboard's
// full-status list). Setting hero/pin flags now also shadow-writes into
// D1 after the real Appwrite write succeeds.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

async function shadowEditArticle(id: string, data: Record<string, any>, jwt: string | null) {
  if (!jwt) return;
  try {
    await fetch(`${WORKER_URL}/articles/${id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {}
}

const genres = ['Voice of People', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Health', 'Education', 'Technology', 'Sports', 'Business'];
const regions = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];

function getImageUrl(fileId: string) {
  if (!fileId) return '';
  return endpoint + '/storage/buckets/' + bucketId + '/files/' + fileId + '/view?project=' + projectId;
}

export default function CuratePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'genre' | 'region'>('genre');
  const [selected, setSelected] = useState('Politics');
  const [articles, setArticles] = useState<any[]>([]);
  const [busyId, setBusyId] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const labels = (data as any).labels || [];
          const isAdmin = data.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
          if (!isAdmin) {
            setError('Access denied. Admin only.');
            setLoading(false);
            return;
          }
          setLoading(false);
        } else {
          setError('Please log in as admin.');
          setLoading(false);
        }
      } catch {
        setError('Failed to verify access.');
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (loading || error) return;
    loadArticles();
  }, [mode, selected, loading, error]);

  async function loadArticles() {
    const param = mode === 'genre' ? 'genre' : 'district';
    const res = await fetch(WORKER_URL + '/articles?' + param + '=' + encodeURIComponent(selected) + '&limit=40');
    if (res.ok) {
      const data = await res.json();
      setArticles(data.documents || []);
    }
  }

  async function setAsHero(articleId: string) {
    setBusyId(articleId);
    const featField = mode === 'genre' ? 'isGenreFeatured' : 'isRegionFeatured';
    try {
      const workerToken = await getWorkerAuthToken();
      const currentHeroes = articles.filter((a) => a[featField] && a.$id !== articleId);
      for (const h of currentHeroes) {
        await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + h.$id, {
          method: 'PATCH', headers: HJ, credentials: 'include',
          body: JSON.stringify({ data: { [featField]: false } }),
        });
        shadowEditArticle(h.$id, { [featField]: false }, workerToken);
      }
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({ data: { [featField]: true } }),
      });
      shadowEditArticle(articleId, { [featField]: true }, workerToken);
      await loadArticles();
    } finally {
      setBusyId('');
    }
  }

  async function removeHero(articleId: string) {
    setBusyId(articleId);
    const featField = mode === 'genre' ? 'isGenreFeatured' : 'isRegionFeatured';
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({ data: { [featField]: false } }),
      });
      const workerToken = await getWorkerAuthToken();
      shadowEditArticle(articleId, { [featField]: false }, workerToken);
      await loadArticles();
    } finally {
      setBusyId('');
    }
  }

  async function togglePin(articleId: string, currentlyPinned: boolean) {
    const pinField = mode === 'genre' ? 'isGenrePinned' : 'isRegionPinned';
    const currentPinnedCount = articles.filter((a) => a[pinField]).length;
    if (!currentlyPinned && currentPinnedCount >= 3) {
      alert('Maximum 3 pinned articles already set. Unpin one first.');
      return;
    }
    setBusyId(articleId);
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({ data: { [pinField]: !currentlyPinned } }),
      });
      const workerToken = await getWorkerAuthToken();
      shadowEditArticle(articleId, { [pinField]: !currentlyPinned }, workerToken);
      await loadArticles();
    } finally {
      setBusyId('');
    }
  }

  async function syncAuthorNames() {
    setSyncing(true);
    try {
      const jwtRes = await fetch(endpoint + '/account/jwt', { method: 'POST', headers: H, credentials: 'include' });
      const jwtData = await jwtRes.json();
      const res = await fetch('/api/admin/sync-author-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jwt: jwtData.jwt }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Synced! Updated ' + data.updatedCount + ' of ' + data.totalArticles + ' articles.');
        await loadArticles();
      } else {
        alert('Sync failed: ' + (data.error || 'unknown error'));
      }
    } catch {
      alert('Sync failed - network error.');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'system-ui' }}>Loading...</div>;
  if (error) return <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'system-ui', color: '#c41e3a' }}>{error}</div>;

  const featField = mode === 'genre' ? 'isGenreFeatured' : 'isRegionFeatured';
  const pinField = mode === 'genre' ? 'isGenrePinned' : 'isRegionPinned';
  const options = mode === 'genre' ? genres : regions;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>Curate Genre / Region Pages</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={syncAuthorNames} disabled={syncing} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0F4C5C', color: 'white', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>{syncing ? 'Syncing...' : 'Sync Author Names'}</button>
          <Link href="/admin" style={{ color: '#c41e3a', fontWeight: 700, textDecoration: 'none', fontSize: '14px' }}>Back to Admin</Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button onClick={() => { setMode('genre'); setSelected(genres[0]); }} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px', background: mode === 'genre' ? '#c41e3a' : '#e5e7eb', color: mode === 'genre' ? 'white' : '#333' }}>Genres</button>
          <button onClick={() => { setMode('region'); setSelected(regions[0]); }} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '13px', background: mode === 'region' ? '#c41e3a' : '#e5e7eb', color: mode === 'region' ? 'white' : '#333' }}>Regions</button>
        </div>

        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', marginBottom: '24px', background: 'white' }}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {articles.length === 0 && <p style={{ color: '#888', textAlign: 'center', padding: '30px' }}>No articles found for {selected}.</p>}
          {articles.map((a) => (
            <div key={a.$id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', borderRadius: '10px', padding: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {a.imageFileId && <img src={getImageUrl(a.imageFileId)} alt={a.title} style={{ width: '56px', height: '56px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{a.title}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{new Date(a.publishedAt || a.$createdAt).toLocaleDateString()}</div>
              </div>
              {a[featField] && <span style={{ fontSize: '10px', fontWeight: 800, background: '#f5c518', color: '#1a1a1a', padding: '4px 8px', borderRadius: '10px', flexShrink: 0 }}>HERO</span>}
              {a[pinField] && <span style={{ fontSize: '10px', fontWeight: 800, background: '#c41e3a', color: 'white', padding: '4px 8px', borderRadius: '10px', flexShrink: 0 }}>PINNED</span>}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {a[featField] ? (
                  <button disabled={busyId === a.$id} onClick={() => removeHero(a.$id)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>Remove Hero</button>
                ) : (
                  <button disabled={busyId === a.$id} onClick={() => setAsHero(a.$id)} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#f5c518', color: '#1a1a1a', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>Set Hero</button>
                )}
                <button disabled={busyId === a.$id} onClick={() => togglePin(a.$id, !!a[pinField])} style={{ padding: '6px 12px', borderRadius: '6px', border: a[pinField] ? '1px solid #ddd' : 'none', background: a[pinField] ? 'white' : '#c41e3a', color: a[pinField] ? '#333' : 'white', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>{a[pinField] ? 'Unpin' : 'Pin'}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
