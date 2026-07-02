'use client';
import { useState, useEffect } from 'react';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const BUCKET = 'article-image';
const H = { 'X-Appwrite-Project': PROJECT };
const HJ = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };

function getInitials(name: string): string {
  if (!name) return 'U';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

interface Props { userId: string; userName: string; }

export default function ProfileEditor({ userId, userName }: Props) {
  const [docId, setDocId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState(userName || '');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }));
    fetch(ENDPOINT + '/databases/' + DB + '/collections/profiles/documents?queries[]=' + q1 + '&queries[]=' + q2, { headers: H, credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!alive || !d) return;
        const row = (d.documents || [])[0];
        if (row) {
          setDocId(row.$id);
          setAvatarUrl(row.avatarUrl || '');
          setBio(row.bio || '');
          setDisplayName(row.displayName || userName || '');
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId, userName]);

  async function handleFile(e: any) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true); setErr('');
    try {
      const form = new FormData();
      form.append('fileId', 'unique()');
      form.append('file', file);
      const res = await fetch(ENDPOINT + '/storage/buckets/' + BUCKET + '/files', { method: 'POST', headers: H, credentials: 'include', body: form });
      if (!res.ok) throw new Error('upload');
      const f = await res.json();
      setAvatarUrl(ENDPOINT + '/storage/buckets/' + BUCKET + '/files/' + f.$id + '/view?project=' + PROJECT);
    } catch {
      setErr('Image upload failed. Try a smaller JPG or PNG.');
    }
    setUploading(false);
  }

  async function save() {
    setSaving(true); setErr('');
    try {
      const data = { userId, displayName, userName: displayName, bio, avatarUrl };
      let res;
      if (docId) {
        res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/profiles/documents/' + docId, { method: 'PATCH', headers: HJ, credentials: 'include', body: JSON.stringify({ data }) });
      } else {
        res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/profiles/documents', { method: 'POST', headers: HJ, credentials: 'include', body: JSON.stringify({ documentId: 'unique()', data }) });
      }
      if (!res.ok) throw new Error('save');
      window.location.reload();
    } catch {
      setErr('Could not save. Check that Users have Update permission on profiles.');
      setSaving(false);
    }
  }

  const hasImg = avatarUrl && avatarUrl.indexOf('http') === 0;

  return (
    <>
      <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 16px' }}>
        <div style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#f5c518', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 800, border: '4px solid rgba(255,255,255,0.3)', overflow: 'hidden' }}>
          {hasImg ? <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setAvatarUrl('')} /> : getInitials(displayName || userName)}
        </div>
        <button onClick={() => setOpen(true)} title="Edit profile" style={{ position: 'absolute', bottom: 0, right: 0, width: '30px', height: '30px', borderRadius: '50%', background: '#c41e3a', color: 'white', border: '2px solid white', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✎</button>
      </div>

      {open && (
        <div onClick={() => !saving && setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '380px', color: '#1a1a1a', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 800, color: '#c41e3a' }}>Edit Profile</h2>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f5c518', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800, overflow: 'hidden', marginBottom: '8px' }}>
                {hasImg ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(displayName || userName)}
              </div>
              <label style={{ fontSize: '13px', color: '#c41e3a', fontWeight: 700, cursor: 'pointer' }}>
                {uploading ? 'Uploading...' : 'Change photo'}
                <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} disabled={uploading} />
              </label>
            </div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#666' }}>Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', margin: '4px 0 12px', boxSizing: 'border-box', fontSize: '14px' }} />
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#666' }}>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={200} placeholder="Tell people about yourself..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', margin: '4px 0 4px', boxSizing: 'border-box', fontSize: '14px', resize: 'none', fontFamily: 'inherit' }} />
            <div style={{ fontSize: '11px', color: '#999', textAlign: 'right', marginBottom: '12px' }}>{bio.length}/200</div>
            {err && <div style={{ fontSize: '12px', color: '#c41e3a', marginBottom: '12px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setOpen(false)} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #ddd', background: 'white', color: '#666', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving || uploading} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', background: '#c41e3a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
