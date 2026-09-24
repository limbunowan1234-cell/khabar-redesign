'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getWorkerAuthToken } from '@/lib/appwrite';

const endpoint = 'https://api.khabardarjeeling.in';
const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

const genres = ['Voice of People', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Health', 'Education', 'Technology', 'Sports', 'Business'];
const locationDistricts = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];

function generateSlug(title: string): string {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
  return base + '-' + Math.random().toString(36).slice(2, 10);
}

// This page only ever saves with status: 'pending_review' -- never
// 'published', never isBreaking/isFeatured. Publishing a draft this
// generates is a separate, deliberate action taken from the Manage tab's
// Pending queue, by a human, as its own click. That separation is the
// actual safety guarantee here, not a role check -- an admin using this
// tool can draft in one click but can never publish in that same click.
export default function AiDraftPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [sourceText, setSourceText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [sideHeader, setSideHeader] = useState('');
  const [content, setContent] = useState('');
  const [genre, setGenre] = useState('Voice of People');
  const [locationDistrict, setLocationDistrict] = useState('Darjeeling');
  const [authorName, setAuthorName] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(endpoint + '/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const labels = (data as any).labels || [];
          const isAdmin = data.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
          if (!isAdmin) { setError('Access denied. Admin only.'); setLoading(false); return; }
          setUser(data);
          setAuthorName(data.name || '');
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function handleGenerate() {
    if (sourceText.trim().length < 50) { setError('Paste at least 50 characters of source material first.'); return; }
    setGenerating(true); setError(''); setSuccess('');
    try {
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(WORKER_URL + '/ai-draft', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Draft generation failed');
      setTitle(data.draft.title || '');
      setSideHeader(data.draft.sideHeader || '');
      setContent(data.draft.content || '');
      setGenre(data.draft.genre || 'Voice of People');
      setLocationDistrict(data.draft.locationDistrict || 'Darjeeling');
      setHasDraft(true);
    } catch (err: any) { setError(err.message || 'Draft generation failed'); }
    setGenerating(false);
  }

  async function handleSaveAsPending() {
    if (!title || !content) { setError('Title and content required'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const id = crypto.randomUUID();
      const res = await fetch(WORKER_URL + '/articles', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          title, sideHeader, content, genre, locationDistrict,
          slug: generateSlug(title),
          authorName: authorName || user?.name || 'Unknown',
          authorEmail: user?.email || '',
          submitterId: user?.$id || '',
          submitterName: authorName || user?.name || '',
          submitterEmail: user?.email || '',
          status: 'pending_review',
          submittedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSuccess('Saved to the Pending queue -- review and publish it from Manage.');
      setSourceText(''); setTitle(''); setSideHeader(''); setContent('');
      setHasDraft(false);
    } catch (err: any) { setError(err.message || 'Save failed'); }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px' }}>Loading...</div>;

  if (!user) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ fontSize: '18px', marginBottom: '20px', color: '#c41e3a' }}>{error || 'Please login to access this page.'}</p>
      <Link href="/auth"><button style={{ backgroundColor: '#0F4C5C', color: 'white', padding: '12px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Login</button></Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F4C5C, #0a3540)', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/admin" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>Back to Admin</Link>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>AI Draft</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>Paste source material, get a draft. Always lands in Pending review -- never published from here.</p>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '30px 20px' }}>
        {error && <div style={{ background: '#fee2e2', color: '#c41e3a', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>{error}</div>}
        {success && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>{success}</div>}

        <div style={{ background: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Source Material</label>
          <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} placeholder="Paste a press note, a tip, forwarded text, or anything else this should be based on..." rows={8} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '6px', fontSize: '14px', lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#9ca3af' }}>{sourceText.length} characters (minimum 50). Nothing is invented -- the draft only reformats what's here.</p>
          <button onClick={handleGenerate} disabled={generating || sourceText.trim().length < 50} style={{ padding: '12px 24px', background: generating ? '#9ca3af' : '#0F4C5C', color: 'white', border: 'none', borderRadius: '8px', cursor: generating ? 'default' : 'pointer', fontWeight: 700, fontSize: '14px' }}>
            {generating ? 'Generating...' : 'Generate Draft'}
          </button>
        </div>

        {hasDraft && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Review before saving -- everything below is editable</p>

            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Main Header (Title) *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '18px', fontWeight: 700, boxSizing: 'border-box' }} />

            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Side Header</label>
            <input value={sideHeader} onChange={(e) => setSideHeader(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }} />

            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Content *</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '15px', lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Genre</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}>
                  {genres.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>District</label>
                <select value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}>
                  {locationDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Byline</label>
            <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '24px', fontSize: '14px', boxSizing: 'border-box' }} />

            <button onClick={handleSaveAsPending} disabled={saving} style={{ width: '100%', padding: '14px', background: saving ? '#9ca3af' : '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'default' : 'pointer', fontWeight: 700, fontSize: '16px' }}>
              {saving ? 'Saving...' : 'Save to Pending Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
