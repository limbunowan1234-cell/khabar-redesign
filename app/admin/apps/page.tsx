'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWorkerAuthToken } from '@/lib/appwrite';
import { DOWNLOAD_CATEGORIES, appHref, categoryMeta, formatFileSize, type DownloadItem } from '@/lib/downloadCategories';

const endpoint = 'https://api.khabardarjeeling.in';
const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
// The Worker rejects anything bigger (Cloudflare caps request bodies near
// 100MB). Bigger files go in by external link instead.
const MAX_UPLOAD_BYTES = 90 * 1024 * 1024;
const MAX_SHOTS = 8;

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

async function uploadImage(file: File): Promise<string> {
  const token = await getWorkerAuthToken();
  if (!token) throw new Error('Not authenticated');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(WORKER_URL + '/cdn/articles', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Image upload failed (images only, max 10MB)');
  return data.fileId;
}

const labelStyle = { display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' } as const;
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit' } as const;
const img = (id: string) => WORKER_URL + '/cdn/articles/' + id;

export default function AdminAppsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [items, setItems] = useState<DownloadItem[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<string>('apps');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [appStoreUrl, setAppStoreUrl] = useState('');
  const [iconFileId, setIconFileId] = useState('');
  const [iconUploading, setIconUploading] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [shotsBusy, setShotsBusy] = useState(0);
  const [dragOn, setDragOn] = useState(false);
  const shotsUploading = shotsBusy > 0;
  const [sourceMode, setSourceMode] = useState<'upload' | 'link' | 'none'>('upload');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const editing = editingId ? items.find((i) => i.$id === editingId) || null : null;
  const pending = items.filter((i) => i.status === 'pending');
  const others = items.filter((i) => i.status !== 'pending');

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

  async function patch(id: string, body: Record<string, unknown>) {
    const token = await getWorkerAuthToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${WORKER_URL}/downloads/${id}`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Update failed');
  }

  function resetForm() {
    setEditingId(null); setTitle(''); setTagline(''); setCategory('apps'); setDescription(''); setVersion('');
    setDeveloperName(''); setWebsiteUrl(''); setPlayStoreUrl(''); setAppStoreUrl('');
    setIconFileId(''); setScreenshots([]); setSourceMode('upload'); setNewFile(null); setExternalUrl('');
    setActive(true); setFeatured(false); setProgress(0);
  }

  function startEdit(item: DownloadItem) {
    setEditingId(item.$id); setTitle(item.title); setTagline(item.tagline || ''); setCategory(item.category);
    setDescription(item.description || ''); setVersion(item.version || ''); setDeveloperName(item.developerName || '');
    setWebsiteUrl(item.websiteUrl || ''); setPlayStoreUrl(item.playStoreUrl || ''); setAppStoreUrl(item.appStoreUrl || '');
    setIconFileId(item.iconFileId || ''); setScreenshots(item.screenshots || []);
    setSourceMode(item.hosted ? 'upload' : item.externalUrl ? 'link' : 'none'); setNewFile(null); setExternalUrl(item.externalUrl || '');
    setActive(item.active !== false); setFeatured(!!item.featured); setProgress(0); setError(''); setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleIconUpload(file: File) {
    setIconUploading(true); setError('');
    try { setIconFileId(await uploadImage(file)); } catch (err: any) { setError(err.message || 'Icon upload failed'); }
    setIconUploading(false);
  }

  async function handleShotsUpload(files: FileList | File[] | null) {
    if (!files) return;
    setError('');
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    const room = Math.max(MAX_SHOTS - screenshots.length - shotsBusy, 0);
    const list = images.slice(0, room);
    if (images.length < Array.from(files).length) setError('Only image files can be added as photos.');
    else if (images.length > room) setError(`Up to ${MAX_SHOTS} photos are kept.`);
    setShotsBusy((n) => n + list.length);
    for (const f of list) {
      try {
        const id = await uploadImage(f);
        setScreenshots((s) => [...s, id]);
      } catch (err: any) { setError(err.message || 'Photo upload failed'); }
      setShotsBusy((n) => n - 1);
    }
  }

  function moveShot(index: number, delta: number) {
    setScreenshots((s) => {
      const a = [...s];
      const j = index + delta;
      if (j < 0 || j >= a.length) return a;
      [a[index], a[j]] = [a[j], a[index]];
      return a;
    });
  }

  async function handleSave() {
    setError(''); setSuccess('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (sourceMode === 'link' && !/^https?:\/\//i.test(externalUrl.trim())) { setError('Enter a download link starting with http:// or https://'); return; }
    if (sourceMode === 'upload' && !newFile && !editing?.hosted) { setError('Choose a file to upload, or switch to a link / no file'); return; }
    if (sourceMode === 'none' && ![websiteUrl, playStoreUrl, appStoreUrl].some((u) => u.trim())) { setError('With no file, add at least a website or store link'); return; }
    if (newFile && newFile.size > MAX_UPLOAD_BYTES) { setError('That file is over 90MB. Host it elsewhere (e.g. Google Drive, GitHub Releases) and add it by link.'); return; }
    if (editing?.hosted && sourceMode !== 'upload' && !confirm('This will delete the file you uploaded. Continue?')) return;

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
      } else if (sourceMode === 'link') {
        fileFields = { externalUrl: externalUrl.trim(), fileKey: null, fileName: null };
      } else {
        fileFields = { externalUrl: null, fileKey: null, fileName: null };
      }

      const payload = {
        title: title.trim(), tagline: tagline.trim() || null, category,
        description: description.trim() || null, version: version.trim() || null,
        developerName: developerName.trim() || null,
        websiteUrl: websiteUrl.trim() || null, playStoreUrl: playStoreUrl.trim() || null, appStoreUrl: appStoreUrl.trim() || null,
        iconFileId: iconFileId || null, screenshots, active, featured, ...fileFields,
      };
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(editingId ? `${WORKER_URL}/downloads/${editingId}` : `${WORKER_URL}/downloads`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSuccess(editingId ? 'Saved.' : 'Added -- it is live in the store.');
      resetForm();
      await loadItems();
    } catch (err: any) { setError(err.message || 'Save failed'); }
    setSaving(false);
  }

  async function approve(item: DownloadItem) {
    setError(''); setSuccess('');
    try { await patch(item.$id, { status: 'approved' }); setSuccess(`"${item.title}" is now live.`); await loadItems(); }
    catch (err: any) { setError(err.message || 'Approve failed'); }
  }

  async function reject(item: DownloadItem) {
    const reason = prompt(`Why is "${item.title}" not approved? (the submitter will see this -- leave blank for no reason)`);
    if (reason === null) return;
    setError(''); setSuccess('');
    try { await patch(item.$id, { status: 'rejected', rejectionReason: reason.trim() || null }); setSuccess(`"${item.title}" was rejected.`); await loadItems(); }
    catch (err: any) { setError(err.message || 'Reject failed'); }
  }

  async function toggleActive(item: DownloadItem) {
    try { await patch(item.$id, { active: !item.active }); await loadItems(); }
    catch (err: any) { setError(err.message || 'Update failed'); }
  }

  async function toggleFeatured(item: DownloadItem) {
    try { await patch(item.$id, { featured: !item.featured }); await loadItems(); }
    catch (err: any) { setError(err.message || 'Update failed'); }
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

  const pill = (text: string, bg: string, fg: string) => (
    <span style={{ background: bg, color: fg, padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{text}</span>
  );
  const linkStyle = { color: '#1565c0', fontSize: '13px', wordBreak: 'break-all' } as const;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F4C5C, #0a3540)', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/admin" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>Back to Admin</Link>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Apps &amp; Games</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>
            Review submissions and manage the public <Link href="/apps" style={{ color: '#f5c518' }}>/apps</Link> store.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '30px 20px' }}>
        {error && <div style={{ background: '#fee2e2', color: '#c41e3a', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>{error}</div>}
        {success && <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: '8px', marginBottom: '18px', fontSize: '14px' }}>{success}</div>}

        {pending.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 800 }}>Needs review ({pending.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {pending.map((item) => {
                const cat = categoryMeta(item.category);
                return (
                  <div key={item.$id} style={{ background: 'white', borderRadius: '12px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #f5c518' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '12px' }}>
                      {item.iconFileId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img(item.iconFileId)} alt="" style={{ width: '64px', height: '64px', borderRadius: '16px', objectFit: 'cover', flexShrink: 0 }} />
                      ) : <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', flexShrink: 0 }}>{cat.emoji}</div>}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '16px', overflowWrap: 'anywhere' }}>{item.title}{item.version ? ' · v' + item.version.replace(/^v/i, '') : ''}</div>
                        {item.tagline && <div style={{ fontSize: '13px', color: '#4b5563' }}>{item.tagline}</div>}
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>
                          {cat.label} · by <strong>{item.developerName || 'unknown'}</strong>
                          {item.developerEmail && <> · <a href={'mailto:' + item.developerEmail} style={{ color: '#1565c0' }}>{item.developerEmail}</a></>}
                        </div>
                      </div>
                    </div>

                    {item.description && <p style={{ margin: '0 0 12px', fontSize: '13px', lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.description}</p>}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
                      {([['Download link', item.externalUrl], ['Google Play', item.playStoreUrl], ['App Store', item.appStoreUrl], ['Website', item.websiteUrl]] as const).map(([label, url]) => url ? (
                        <div key={label} style={{ fontSize: '12px', color: '#6b7280' }}>{label}: <a href={url} target="_blank" rel="noopener noreferrer nofollow" style={linkStyle}>{url}</a></div>
                      ) : null)}
                    </div>

                    {item.screenshots.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '14px' }}>
                        {item.screenshots.map((id) => (
                          <a key={id} href={img(id)} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img(id)} alt="" style={{ height: '120px', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'block' }} />
                          </a>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button onClick={() => approve(item)} style={{ padding: '9px 18px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 800, fontSize: '13px' }}>Approve &amp; publish</button>
                      <button onClick={() => reject(item)} style={{ padding: '9px 18px', background: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>Reject…</button>
                      <button onClick={() => startEdit(item)} style={{ padding: '9px 14px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Edit first</button>
                      <button onClick={() => handleDelete(item)} style={{ padding: '9px 14px', background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '12px', padding: '26px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '28px' }}>
          <h2 style={{ margin: '0 0 18px', fontSize: '17px', fontWeight: 800 }}>{editingId ? 'Edit entry' : 'Add a new entry'}</h2>

          <label style={labelStyle}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Card Magic Tricks" style={{ ...inputStyle, marginBottom: '16px' }} />

          <label style={labelStyle}>Tagline (one line, shown on cards)</label>
          <input value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Play the Top 100 Hills Hits" style={{ ...inputStyle, marginBottom: '16px' }} />

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
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What it is, what it needs, anything people should know" style={{ ...inputStyle, marginBottom: '16px', resize: 'vertical' }} />

          <label style={labelStyle}>Developer name (optional)</label>
          <input value={developerName} onChange={(e) => setDeveloperName(e.target.value)} placeholder="Who made it" style={{ ...inputStyle, marginBottom: '16px' }} />

          <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', padding: '18px', marginBottom: '16px', background: '#fcfcfd' }}>
            <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '2px' }}>Photos</div>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>An icon, plus up to {MAX_SHOTS} in-app images (screenshots from inside the app). Images only, up to 10MB each. The first in-app image is the one shown on the featured carousel.</p>

            <label style={labelStyle}>App icon (square works best)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{ width: '72px', height: '72px', borderRadius: '16px', border: '2px dashed #d1d5db', background: '#f3f4f6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#9ca3af', textAlign: 'center', flexShrink: 0 }}>
                {iconFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img(iconFileId)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : iconUploading ? 'Uploading…' : 'No icon'}
              </div>
              <label style={{ padding: '8px 14px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: iconUploading ? 'default' : 'pointer', opacity: iconUploading ? 0.6 : 1 }}>
                {iconFileId ? 'Change icon' : 'Upload icon'}
                <input type="file" accept="image/*" hidden disabled={iconUploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIconUpload(f); e.target.value = ''; }} />
              </label>
              {iconFileId && !iconUploading && <button type="button" onClick={() => setIconFileId('')} style={{ background: 'none', border: 'none', color: '#c41e3a', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>Remove</button>}
            </div>

            <label style={labelStyle}>In-app images <span style={{ color: '#9ca3af', fontWeight: 600 }}>({screenshots.length + shotsBusy}/{MAX_SHOTS})</span></label>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOn(true); }}
              onDragLeave={() => setDragOn(false)}
              onDrop={(e) => { e.preventDefault(); setDragOn(false); handleShotsUpload(e.dataTransfer.files); }}
              style={{ display: 'block', border: '2px dashed ' + (dragOn ? '#c41e3a' : '#d1d5db'), background: dragOn ? '#fef2f2' : 'white', borderRadius: '12px', padding: '22px', textAlign: 'center', fontSize: '14px', color: '#6b7280', cursor: screenshots.length + shotsBusy >= MAX_SHOTS ? 'default' : 'pointer', opacity: screenshots.length + shotsBusy >= MAX_SHOTS ? 0.5 : 1 }}
            >
              {screenshots.length + shotsBusy >= MAX_SHOTS ? 'Photo limit reached' : <>Drag photos here, or <strong style={{ color: '#c41e3a' }}>browse</strong></>}
              <input type="file" accept="image/*" multiple hidden disabled={screenshots.length + shotsBusy >= MAX_SHOTS} onChange={(e) => { handleShotsUpload(e.target.files); e.target.value = ''; }} />
            </label>

            {(screenshots.length > 0 || shotsBusy > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '16px' }}>
                {screenshots.map((id, i) => (
                  <div key={id} style={{ width: '96px' }}>
                    <div style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(id)} alt={'Screenshot ' + (i + 1)} style={{ width: '96px', height: '150px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #e5e7eb', display: 'block', background: '#f3f4f6' }} />
                      {i === 0 && <span style={{ position: 'absolute', left: '6px', bottom: '6px', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '999px' }}>COVER</span>}
                      <button type="button" onClick={() => setScreenshots((s) => s.filter((x) => x !== id))} aria-label="Remove photo" style={{ position: 'absolute', top: '-7px', right: '-7px', width: '24px', height: '24px', borderRadius: '50%', border: '2px solid white', background: '#c41e3a', color: 'white', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '6px' }}>
                      <button type="button" onClick={() => moveShot(i, -1)} disabled={i === 0} aria-label="Move earlier" style={{ padding: '2px 9px', border: '1px solid #d1d5db', background: 'white', borderRadius: '6px', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.35 : 1 }}>←</button>
                      <button type="button" onClick={() => moveShot(i, 1)} disabled={i === screenshots.length - 1} aria-label="Move later" style={{ padding: '2px 9px', border: '1px solid #d1d5db', background: 'white', borderRadius: '6px', cursor: i === screenshots.length - 1 ? 'default' : 'pointer', opacity: i === screenshots.length - 1 ? 0.35 : 1 }}>→</button>
                    </div>
                  </div>
                ))}
                {Array.from({ length: shotsBusy }).map((_, i) => (
                  <div key={'busy' + i} style={{ width: '96px', height: '150px', borderRadius: '10px', border: '1px dashed #d1d5db', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#9ca3af' }}>Uploading…</div>
                ))}
              </div>
            )}
          </div>

          <label style={labelStyle}>Links (optional)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
            <input value={playStoreUrl} onChange={(e) => setPlayStoreUrl(e.target.value)} placeholder="Google Play link" style={inputStyle} />
            <input value={appStoreUrl} onChange={(e) => setAppStoreUrl(e.target.value)} placeholder="App Store link" style={inputStyle} />
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="Website" style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          </div>

          <label style={labelStyle}>The file</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {([['upload', 'Upload a file (up to 90MB)'], ['link', 'Link to a file hosted elsewhere'], ['none', 'No file (links only)']] as const).map(([mode, text]) => (
              <button key={mode} type="button" onClick={() => setSourceMode(mode)} style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid ' + (sourceMode === mode ? '#0F4C5C' : '#e5e7eb'), background: sourceMode === mode ? '#0F4C5C' : 'white', color: sourceMode === mode ? 'white' : '#374151', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{text}</button>
            ))}
          </div>

          {sourceMode === 'upload' && (
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
          )}
          {sourceMode === 'link' && (
            <div style={{ marginBottom: '16px' }}>
              <input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9ca3af' }}>For files over 90MB. Visitors still click Get on this site (so downloads are counted) and are then sent to this link.</p>
            </div>
          )}
          {sourceMode === 'none' && (
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#9ca3af' }}>The listing will send people to the store / website links above.</p>
          )}

          <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', marginBottom: '22px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Show on the public page
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
              Featured (top carousel)
            </label>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleSave} disabled={saving || iconUploading || shotsUploading} style={{ flex: 1, padding: '13px', background: saving ? '#9ca3af' : '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'default' : 'pointer', fontWeight: 800, fontSize: '15px' }}>
              {saving ? (newFile ? 'Uploading ' + progress + '%...' : 'Saving...') : editingId ? 'Save changes' : 'Add to Apps & Games'}
            </button>
            {editingId && <button onClick={resetForm} disabled={saving} style={{ padding: '13px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>}
          </div>
        </div>

        <h2 style={{ margin: '0 0 12px', fontSize: '17px', fontWeight: 800 }}>All entries ({others.length})</h2>
        {others.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#9ca3af', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>Nothing added yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {others.map((item) => {
              const cat = categoryMeta(item.category);
              return (
                <div key={item.$id} style={{ background: 'white', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: '12px', alignItems: 'center', opacity: item.active === false || item.status === 'rejected' ? 0.65 : 1 }}>
                  {item.iconFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img(item.iconFileId)} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>{cat.emoji}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', overflowWrap: 'anywhere' }}>
                      {item.status === 'approved' ? <Link href={appHref(item)} style={{ color: 'inherit' }}>{item.title}</Link> : item.title}
                      {item.version ? ' · v' + item.version.replace(/^v/i, '') : ''}
                      {item.featured && <span style={{ marginLeft: '6px' }}>{pill('Featured', '#fff3cd', '#8a5a00')}</span>}
                      {item.status === 'rejected' && <span style={{ marginLeft: '6px' }}>{pill('Rejected', '#fde1e6', '#9b1530')}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {cat.label} · {item.hosted ? 'hosted' + (item.sizeBytes ? ' (' + formatFileSize(item.sizeBytes) + ')' : '') : item.externalUrl ? 'external link' : 'links only'} · {item.downloadCount.toLocaleString()} download{item.downloadCount === 1 ? '' : 's'}{item.active === false ? ' · HIDDEN' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button onClick={() => startEdit(item)} style={{ padding: '6px 12px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Edit</button>
                    {item.status === 'approved' && <button onClick={() => toggleFeatured(item)} style={{ padding: '6px 12px', background: '#fff8e1', color: '#8a5a00', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>{item.featured ? 'Unfeature' : 'Feature'}</button>}
                    {item.status === 'rejected' && <button onClick={() => approve(item)} style={{ padding: '6px 12px', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Approve</button>}
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
