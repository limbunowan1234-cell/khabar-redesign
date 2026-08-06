'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const dbId = 'Khabar_db';
const bucketId = 'article-image';

function getImageUrl(fileId: string) {
  return endpoint + '/storage/buckets/' + bucketId + '/files/' + fileId + '/view?project=' + projectId;
}

export default function HillsInFramePostPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [myPhotos, setMyPhotos] = useState<any[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [imageFileId, setImageFileId] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const labels = (data as any).labels || [];
          if (!labels.includes('photographer')) {
            setError('Access denied. Photographer role required.');
            setLoading(false);
            return;
          }
          setUser(data);
          loadMyPhotos(data.$id);
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

  async function loadMyPhotos(userId: string) {
    setLoadingPhotos(true);
    try {
      const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [userId] }));
      const q2 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/photography/documents?queries[]=' + q1 + '&queries[]=' + q2, { headers: H, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setMyPhotos(data.documents || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingPhotos(false);
  }

  async function handleImageUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('fileId', 'unique()');
      formData.append('file', file);
      const res = await fetch(endpoint + '/storage/buckets/' + bucketId + '/files', { method: 'POST', headers: H, credentials: 'include', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImageFileId(data.$id);
      setImagePreview(getImageUrl(data.$id));
    } catch {
      setSubmitError('Photo upload failed.');
    }
    setUploading(false);
  }

  function resetForm() {
    setTitle('');
    setCaption('');
    setLocation('');
    setImageFileId('');
    setImagePreview('');
    setEditingId(null);
  }

  function startEdit(photo: any) {
    setEditingId(photo.$id);
    setTitle(photo.title || '');
    setCaption(photo.caption || '');
    setLocation(photo.location || '');
    setImageFileId(photo.imageFileId || '');
    setImagePreview(photo.imageFileId ? getImageUrl(photo.imageFileId) : '');
    setSubmitError('');
    setSubmitSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSubmitError(''); setSubmitSuccess('');
    if (!title.trim() || !caption.trim() || !imageFileId) {
      setSubmitError('Title, caption, and photo are all required.');
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      const routeUrl = editingId ? '/api/hills-in-frame/update' : '/api/hills-in-frame/create';
      const jwtRes = await fetch(endpoint + '/account/jwt', { method: 'POST', headers: H, credentials: 'include' });
      const jwtData = await jwtRes.json();
      const body: any = { title: title.trim(), caption: caption.trim(), location: location.trim() || null, imageFileId, jwt: jwtData.jwt };
      if (editingId) body.id = editingId;
      const res = await fetch(routeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      setSubmitSuccess(editingId ? 'Photo updated!' : 'Photo published!');
      resetForm();
      loadMyPhotos(user.$id);
    } catch (err: any) {
      setSubmitError(err.message || 'Save failed');
    }
    setSubmitting(false);
  }

  async function handleDelete(photoId: string) {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setDeletingId(photoId);
    try {
      const jwtRes = await fetch(endpoint + '/account/jwt', { method: 'POST', headers: H, credentials: 'include' });
      const jwtData = await jwtRes.json();
      const res = await fetch('/api/hills-in-frame/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: photoId, jwt: jwtData.jwt })
      });
      if (res.ok) {
        setMyPhotos(prev => prev.filter(p => p.$id !== photoId));
      } else {
        alert('Delete failed');
      }
    } catch {
      alert('Delete failed');
    }
    setDeletingId(null);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px' }}>Loading...</div>;
  if (error) return (
    <div style={{ textAlign: 'center', padding: '80px' }}>
      <p style={{ color: '#c41e3a', fontWeight: 700 }}>{error}</p>
      <Link href="/" style={{ color: '#c41e3a' }}>Back to Home</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #374151, #1f2937)', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link href="/hills-in-frame" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>Back to Hills in Frame</Link>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Hills in Frame - Photographer Panel</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Welcome, {user?.name}</p>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '30px 20px' }}>

        <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: 800, color: '#1a1a1a' }}>{editingId ? 'Edit Photo' : 'Upload New Photo'}</h2>

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Photo</label>
          <div style={{ border: '2px dashed #ccc', borderRadius: '8px', padding: '16px', textAlign: 'center', marginBottom: '18px' }}>
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', marginBottom: '10px' }} />
            ) : (
              <p style={{ color: '#9ca3af', marginBottom: '10px' }}>No photo selected</p>
            )}
            <input id="photoInput" type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ display: 'none' }} />
            <label htmlFor="photoInput" style={{ display: 'inline-block', background: '#374151', color: 'white', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              {uploading ? 'Uploading...' : imageFileId ? 'Change Photo' : 'Choose Photo'}
            </label>
          </div>

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning mist over Tiger Hill" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '15px', boxSizing: 'border-box' }} />

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Tiger Hill, Ghum" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }} />

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Caption *</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Tell the story behind this photo..." rows={4} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />

          {submitError && <div style={{ padding: '12px', background: '#fee2e2', color: '#c41e3a', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{submitError}</div>}
          {submitSuccess && <div style={{ padding: '12px', background: '#dcfce7', color: '#15803d', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{submitSuccess}</div>}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={submitting} style={{ flex: 1, padding: '13px', background: submitting ? '#999' : '#1f2937', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: submitting ? 'default' : 'pointer' }}>
              {submitting ? 'Saving...' : editingId ? 'Update Photo' : 'Publish Photo'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={{ padding: '13px 20px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>Cancel</button>
            )}
          </div>
        </form>

        <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#1a1a1a', marginBottom: '16px' }}>My Photos ({myPhotos.length})</h2>

        {loadingPhotos ? (
          <p style={{ color: '#9ca3af' }}>Loading...</p>
        ) : myPhotos.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#9ca3af' }}>No photos yet - upload your first one above.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {myPhotos.map(photo => (
              <div key={photo.$id} style={{ background: 'white', borderRadius: '8px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', gap: '14px', alignItems: 'center' }}>
                {photo.imageFileId && (
                  <img src={getImageUrl(photo.imageFileId)} alt={photo.title} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{photo.title}</div>
                  {photo.location && <div style={{ fontSize: '12px', color: '#6b7280' }}>📍 {photo.location}</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => startEdit(photo)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Edit</button>
                  <button onClick={() => handleDelete(photo.$id)} disabled={deletingId === photo.$id} style={{ background: '#fee2e2', color: '#c41e3a', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    {deletingId === photo.$id ? '...' : 'Delete'}
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
