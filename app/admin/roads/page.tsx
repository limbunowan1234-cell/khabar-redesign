'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWorkerAuthToken } from '@/lib/appwrite';
import { ROAD_STATUSES, statusMeta, formatDay, daysSince, isStale, type RoadEntry } from '@/lib/roadStatus';

const endpoint = 'https://api.khabardarjeeling.in';
const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

const labelStyle = { display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' } as const;
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' } as const;

export default function AdminRoadsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [items, setItems] = useState<RoadEntry[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string>('restricted');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [diversion, setDiversion] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [source, setSource] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

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
          await loadItems();
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function authed(path: string, init: RequestInit = {}) {
    const token = await getWorkerAuthToken();
    if (!token) throw new Error('Not authenticated');
    return fetch(WORKER_URL + path, { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
  }

  async function loadItems() {
    try {
      const res = await authed('/roads?all=1');
      if (res.ok) { const d = await res.json(); setItems(d.documents || []); }
    } catch {}
  }

  function resetForm() {
    setEditingId(null); setName(''); setStatus('restricted'); setSummary(''); setDetails('');
    setDiversion(''); setNextDate(''); setSource(''); setLinkUrl(''); setActive(true);
  }

  function startEdit(r: RoadEntry) {
    setEditingId(r.$id); setName(r.name); setStatus(r.status); setSummary(r.summary);
    setDetails(r.details || ''); setDiversion(r.diversion || ''); setNextDate(r.nextDate || '');
    setSource(r.source || ''); setLinkUrl(r.linkUrl || ''); setActive(r.active !== false);
    setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave() {
    setError(''); setSuccess('');
    if (!name.trim()) { setError('Road or project name is required'); return; }
    if (!summary.trim()) { setError('A one-line summary is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), status, summary: summary.trim(),
        details: details.trim() || null, diversion: diversion.trim() || null,
        nextDate: nextDate.trim() || null, source: source.trim() || null,
        linkUrl: linkUrl.trim() || null, active,
      };
      const res = await authed(editingId ? '/roads/' + editingId : '/roads', { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess(editingId ? 'Saved. The public page refreshes within a minute.' : 'Added. It shows on the public page within a minute.');
      resetForm();
      await loadItems();
    } catch (err: any) { setError(err.message || 'Save failed'); }
    setSaving(false);
  }

  // Re-stamps the entry's "updated" date without changing anything, for a
  // road that's still exactly as described -- keeps the public page's
  // "last confirmed" honest instead of letting it look stale.
  async function confirmToday(r: RoadEntry) {
    try {
      const res = await authed('/roads/' + r.$id, { method: 'PATCH', body: JSON.stringify({ active: r.active !== false }) });
      if (!res.ok) throw new Error('Update failed');
      setSuccess('"' + r.name + '" marked as confirmed today.');
      await loadItems();
    } catch (err: any) { setError(err.message || 'Update failed'); }
  }

  async function toggleActive(r: RoadEntry) {
    try {
      const res = await authed('/roads/' + r.$id, { method: 'PATCH', body: JSON.stringify({ active: !(r.active !== false) }) });
      if (!res.ok) throw new Error('Update failed');
      await loadItems();
    } catch (err: any) { setError(err.message || 'Update failed'); }
  }

  async function handleDelete(r: RoadEntry) {
    if (!confirm('Delete "' + r.name + '"? This can\'t be undone. (Use Hide instead to take it off the public page but keep it here.)')) return;
    try {
      const res = await authed('/roads/' + r.$id, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      if (editingId === r.$id) resetForm();
      await loadItems();
    } catch (err: any) { setError(err.message || 'Delete failed'); }
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
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Road Status</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>
            Edits the public <Link href="/road-status" style={{ color: '#f5c518' }}>/road-status</Link> page.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '30px 20px' }}>
        {error && <div style={{ background: '#fee2e2', color: '#c41e3a', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>{error}</div>}
        {success && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>{success}</div>}

        <div style={{ background: 'white', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '28px' }}>
          <h2 style={{ margin: '0 0 18px', fontSize: '17px', fontWeight: 800 }}>{editingId ? 'Edit entry' : 'Add a road or project'}</h2>

          <label style={labelStyle}>Road or project *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NH-10: Sevoke to Rangpo" style={{ ...inputStyle, marginBottom: '16px' }} />

          <label style={labelStyle}>Status *</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {ROAD_STATUSES.map((s) => (
              <button key={s.key} type="button" onClick={() => setStatus(s.key)} style={{ padding: '8px 14px', borderRadius: '999px', border: '2px solid ' + (status === s.key ? s.color : '#e5e7eb'), background: status === s.key ? s.bg : 'white', color: status === s.key ? s.color : '#374151', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>{s.label}</button>
            ))}
          </div>

          <label style={labelStyle}>One-line summary * <span style={{ fontWeight: 400, color: '#9ca3af' }}>(the first thing readers see)</span></label>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g. Closed to all vehicles 9 pm to 6 am every night until December 13." style={{ ...inputStyle, marginBottom: '16px' }} />

          <label style={labelStyle}>Diversion / alternative route</label>
          <textarea value={diversion} onChange={(e) => setDiversion(e.target.value)} rows={2} placeholder="Shown in its own box. e.g. Gorubathan–Lava–Pedong–Rhenock (about 175 km)" style={{ ...inputStyle, marginBottom: '16px', resize: 'vertical' }} />

          <label style={labelStyle}>What happens next</label>
          <input value={nextDate} onChange={(e) => setNextDate(e.target.value)} placeholder="e.g. Night closure ends December 13" style={{ ...inputStyle, marginBottom: '16px' }} />

          <label style={labelStyle}>More details</label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder="Shown under a 'More details' toggle" style={{ ...inputStyle, marginBottom: '16px', resize: 'vertical' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Source</label>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. NHIDCL circular; ETV Bharat (Nov 21)" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>&ldquo;Full details&rdquo; link</label>
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/article/... or https://..." style={inputStyle} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '22px', cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Show on the public page
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '13px', background: saving ? '#9ca3af' : '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'default' : 'pointer', fontWeight: 800, fontSize: '15px' }}>
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add to Road Status'}
            </button>
            {editingId && <button onClick={resetForm} disabled={saving} style={{ padding: '13px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>}
          </div>
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 800 }}>All entries ({items.length})</h2>
        {items.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>Nothing added yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((r) => {
              const s = statusMeta(r.status);
              const stale = isStale(r);
              return (
                <div key={r.$id} style={{ background: 'white', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: '12px', alignItems: 'center', opacity: r.active === false ? 0.6 : 1, borderLeft: '4px solid ' + s.color }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', overflowWrap: 'anywhere' }}>
                      <span style={{ background: s.bg, color: s.color, padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', marginRight: '8px' }}>{s.label}</span>
                      {r.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', overflowWrap: 'anywhere' }}>{r.summary}</div>
                    <div style={{ fontSize: '11px', marginTop: '4px', color: stale ? '#b45309' : '#9ca3af', fontWeight: stale ? 700 : 400 }}>
                      Updated {formatDay(r.updatedAt)}{stale ? ' · ' + daysSince(r.updatedAt) + ' days ago, readers see a "check before you travel" warning' : ''}{r.active === false ? ' · HIDDEN' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '230px' }}>
                    <button onClick={() => confirmToday(r)} title="Nothing has changed: refresh its date" style={{ padding: '6px 12px', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Still accurate</button>
                    <button onClick={() => startEdit(r)} style={{ padding: '6px 12px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => toggleActive(r)} style={{ padding: '6px 12px', background: '#fff3e0', color: '#e65100', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>{r.active === false ? 'Show' : 'Hide'}</button>
                    <button onClick={() => handleDelete(r)} style={{ padding: '6px 12px', background: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
