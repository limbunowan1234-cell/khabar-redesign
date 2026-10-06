'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWorkerAuthToken } from '@/lib/appwrite';
import { DOWNLOAD_CATEGORIES, categoryMeta, formatFileSize, type DownloadItem } from '@/lib/downloadCategories';

const endpoint = 'https://api.khabardarjeeling.in';
const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
// The Worker rejects anything bigger (Cloudflare caps request bodies near
// 100MB). Bigger files go in by external link instead.
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;

// XHR rather than fetch so a big upload can show real progress.
function uploadFile(file: File, token: string, onProgress: (pct: number) => void): Promise<{ fileKey: string; fileName: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${WORKER_URL}/downloads/upload?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      let data: any = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || 'Upload failed (' + xhr.status + ')'));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

const labelStyle = { display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' } as const;
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' } as const;

export default function AdminAppsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [items, setItems] = useState<DownloadItem[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('apps');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [iconFileId, setIconFileId] = useState('');
  const [iconUploading, setIconUploading] = useState(false);
  const [sourceMode, setSourceMode] = useState<'upload' | 'link'>('upload');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const editing = editingId ? items.find((i) => i.$id === editingId) || null : null;

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

  async function loadItems() {
    try {
      const token = await getWorkerAuthToken();
      const res = await fetch(WORKER_URL + '/downloads?all=1', token ? { headers: { Authorization: 'Bearer ' + token } } : undefined);
      if (res.ok) { const d = await res.json(); setItems(d.documents || []); }
    } catch {}
  }

  function resetForm() {
    setEditingId(null); setTitle(''); setCategory('apps'); setDescription(''); setVersion('');
    setIconFileId(''); setSourceMode('upload'); setNewFile(null); setExternalUrl(''); setActive(true); setProgress(0);
  }

  function startEdit(item: DownloadItem) {
    setEditingId(item.$id); setTitle(item.title); setCategory(item.category);
    setDescription(item.description || ''); setVersion(item.version || ''); setIconFileId(item.iconFileId || '');
    setSourceMode(item.hosted ? 'upload' : 'link'); setNewFile(null); setExternalUrl(item.externalUrl || '');
    setActive(item.active !== false); setProgress(0); setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleIconUpload(file: File) {
    setIconUploading(true); setError('');
    try {
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(WORKER_URL + '/cdn/articles', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Icon upload failed (images only, max 10MB)');
      setIconFileId(data.fileId);
    } catch (err: any) { setError(err.message || 'Icon upload failed'); }
    setIconUploading(false);
  }

  async function handleSave() {
    setError(''); setSuccess('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (sourceMode === 'link' && !/^https?:\/\//i.test(externalUrl.trim())) { setError('Enter a link starting with http:// or https://'); return; }
    if (sourceMode === 'upload' && !newFile && !editing?.hosted) { setError('Choose a file to upload, or switch to an external link'); return; }
    if (newFile && newFile.size > MAX_UPLOAD_BYTES) { setError('That file is over 90MB. Host it elsewhere (e.g. Google Drive, GitHub Releases) and add it by external link.'); return; }
    if (editing?.hosted && sourceMode === 'link' && !confirm('Switching to an external link will delete the file you uploaded. Continue?')) return;

    setSaving(true); setProgress(0);
    try {
      let fileFields: Record<string, unknown> = {};
      if (sourceMode === 'upload') {
        if (newFile) {
          const token = await getWorkerAuthToken();
          if (!token) throw new Error('Not authenticated');
          const up = await uploadFile(newFile, token, setProgress);
          fileFields = { fileKey: up.fileKey, fileName: up.fileName, externalUrl: null };
        }
      } else {
        fileFields = { externalUrl: externalUrl.trim(), fileKey: null, fileName: null };
      }

      const payload = { title: title.trim(), category, description: description.trim() || null, version: version.trim() || null, iconFileId: iconFileId || null, active, ...fileFields };
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(editingId ? `${WORKER_URL}/downloads/${editingId}` : `${WORKER_URL}/downloads`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess(editingId ? 'Saved.' : 'Added -- it is live on the Apps & Games page.');
      resetForm();
      await loadItems();
    } catch (err: any) { setError(err.message || 'Save failed'); }
    setSaving(false);
  }

  async function toggleActive(item: DownloadItem) {
    try {
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${WORKER_URL}/downloads/${item.$id}`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      });
      if (!res.ok) throw new Error('Update failed');
      await loadItems();
    } catch (err: any) { setError(err.message || 'Update failed'); }
  }

  async function handleDelete(item: DownloadItem) {
    if (!confirm(`Delete "${item.title}"${item.hosted ? ' and its uploaded file' : ''}? This can't be undone.`)) return;
    try {
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${WORKER_URL}/downloads/${item.$id}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error('Delete failed');
      if (editingId === item.$id) resetForm();
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
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Apps &amp; Games</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>
            Add downloads for the public <Link href="/apps" style={{ color: '#f5c518' }}>/apps</Link> page.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '30px 20px' }}>
        {error && <div style={{ background: '#fee2e2', color: '#c41e3a', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>{error}</div>}
        {success && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>{success}</div>}

        <div style={{ background: 'white', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '28px' }}>
          <h2 style={{ margin: '0 0 18px', fontSize: '17px', fontWeight: 800 }}>{editingId ? 'Edit entry' : 'Add a new entry'}</h2>

          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Card Magic Tricks" style={{ ...inputStyle, marginBottom: '16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Category *</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                {DOWNLOAD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Version (optional)</label>
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 1.2" style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What it is, what it needs, anything people should know" style={{ ...inputStyle, marginBottom: '16px', resize: 'vertical' }} />

          <label style={labelStyle}>Icon / cover picture (optional)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            {iconFileId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={WORKER_URL + '/cdn/articles/' + iconFileId} alt="" style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover', background: '#f3f4f6' }} />
            )}
            <input type="file" accept="image/*" disabled={iconUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIconUpload(f); }} style={{ fontSize: '13px' }} />
            {iconUploading && <span style={{ fontSize: '12px', color: '#6b7280' }}>Uploading...</span>}
            {iconFileId && !iconUploading && <button type="button" onClick={() => setIconFileId('')} style={{ background: 'none', border: 'none', color: '#c41e3a', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Remove</button>}
          </div>

          <label style={labelStyle}>The file *</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {([['upload', 'Upload a file (up to 90MB)'], ['link', 'Link to a file hosted elsewhere']] as const).map(([mode, text]) => (
              <button key={mode} type="button" onClick={() => setSourceMode(mode)} style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid ' + (sourceMode === mode ? '#0F4C5C' : '#e5e7eb'), background: sourceMode === mode ? '#0F4C5C' : 'white', color: sourceMode === mode ? 'white' : '#374151', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{text}</button>
            ))}
          </div>

          {sourceMode === 'upload' ? (
            <div style={{ marginBottom: '16px' }}>
              {editing?.hosted && !newFile && (
                <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280' }}>Current file: <strong>{editing.fileName}</strong> {formatFileSize(editing.sizeBytes) && '(' + formatFileSize(editing.sizeBytes) + ')'}. Choose a new one below only to replace it.</p>
              )}
              <input type="file" onChange={(e) => setNewFile(e.target.files?.[0] || null)} style={{ fontSize: '13px' }} />
              {newFile && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6b7280' }}>{newFile.name} &middot; {formatFileSize(newFile.size)}</p>}
              {saving && newFile && (
                <div style={{ marginTop: '10px', height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: progress + '%', height: '100%', background: '#c41e3a', transition: 'width 0.2s' }} />
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: '16px' }}>
              <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9ca3af' }}>For files over 90MB. Visitors still click Download on this site (so downloads are counted) and are then sent to this link.</p>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '22px', cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Show on the public page
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} disabled={saving || iconUploading} style={{ flex: 1, padding: '13px', background: saving ? '#9ca3af' : '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'default' : 'pointer', fontWeight: 800, fontSize: '15px' }}>
              {saving ? (newFile ? 'Uploading ' + progress + '%...' : 'Saving...') : editingId ? 'Save changes' : 'Add to Apps & Games'}
            </button>
            {editingId && <button onClick={resetForm} disabled={saving} style={{ padding: '13px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>}
          </div>
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 800 }}>All entries ({items.length})</h2>
        {items.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>Nothing added yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {items.map((item) => {
              const cat = categoryMeta(item.category);
              return (
                <div key={item.$id} style={{ background: 'white', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: '12px', alignItems: 'center', opacity: item.active === false ? 0.6 : 1 }}>
                  {item.iconFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={WORKER_URL + '/cdn/articles/' + item.iconFileId} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>{cat.emoji}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', overflowWrap: 'anywhere' }}>{item.title}{item.version ? ' · v' + item.version.replace(/^v/i, '') : ''}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {cat.label} · {item.hosted ? 'hosted' + (item.sizeBytes ? ' (' + formatFileSize(item.sizeBytes) + ')' : '') : 'external link'} · {item.downloadCount.toLocaleString()} download{item.downloadCount === 1 ? '' : 's'}{item.active === false ? ' · HIDDEN' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={() => startEdit(item)} style={{ padding: '6px 12px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Edit</button>
                    <button onClick={() => toggleActive(item)} style={{ padding: '6px 12px', background: '#fff3e0', color: '#e65100', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>{item.active === false ? 'Show' : 'Hide'}</button>
                    <button onClick={() => handleDelete(item)} style={{ padding: '6px 12px', background: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Delete</button>
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
