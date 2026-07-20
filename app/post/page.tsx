﻿'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

  const [genre, setGenre] = useState('Voice of People');
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const dbId = 'Khabar_db';
  const [locationArea, setLocationArea] = useState('');
const bucketId = 'article-image';

const genres = ['Voice of People', 'Citizen Journalism', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Photo Story', 'Video', 'Health', 'Education', 'Technology', 'Sports', 'Opinion'];
  const [locationDistrict, setLocationDistrict] = useState('Darjeeling');

function getInitials(name: string) {
  if (!name) return 'KD';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

export default function PostPage() {
  const router = useRouter();
  const [genre, setGenre] = useState('Voice of People');
  const [locationDistrict, setLocationDistrict] = useState('Darjeeling');
  const [locationArea, setLocationArea] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [isContestEntry, setIsContestEntry] = useState(false);
  const [imageFileId, setImageFileId] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
        if (res.ok) { const data = await res.json(); setUser(data); }
        else { router.push('/auth'); }
      } catch { router.push('/auth'); }
      setLoading(false);
    }
    load();
  }, []);

  async function handleImageUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Image must be less than 10MB'); return; }
    setUploadingImage(true);
    setError('');
    try {
      setImagePreview(URL.createObjectURL(file));
      const formData = new FormData();
      formData.append('fileId', 'unique()');
      formData.append('file', file);
      const res = await fetch(endpoint + '/storage/buckets/' + bucketId + '/files', { method: 'POST', headers: H, credentials: 'include', body: formData });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Upload failed'); }
      const data = await res.json();
      setImageFileId(data.$id);
      setImagePreview(endpoint + '/storage/buckets/' + bucketId + '/files/' + data.$id + '/view?project=' + projectId);
      setSuccess('Image uploaded!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) { setError('Upload failed: ' + err.message); setImagePreview(''); }
    setUploadingImage(false);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (content.trim().length < 100) { setError('Content must be at least 100 characters'); return; }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      function generateSlug(text: string): string {
        const base = (text || '')
          .toLowerCase()
          .normalize('NFKD')
          .replace(/[^\x00-\x7F]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .slice(0, 60)
          .replace(/^-+|-+\$/g, '');
        const suffix = Date.now().toString(36);
        return (base ? base + '-' : 'news-') + suffix;
      }
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents', {
        method: 'POST', headers: HJ, credentials: 'include',
        body: JSON.stringify({
          documentId: 'unique()',
          data: {
            title: title.trim(),
            content: content.trim(),
            slug: generateSlug(title),
            genre,
            locationDistrict,
            locationArea: locationArea || null,
            imageFileId: imageFileId || null,
            youtube_id: youtubeId || null,
            isBreaking: false,
            isFeatured: false,
            isContestEntry,
            authorName: user?.name || 'Unknown',
            authorEmail: user?.email || '',
            submitterId: user?.$id || '',
            submitterName: user?.name || '',
            submitterEmail: user?.email || '',
            submitterAvatar: null,
            status: 'published',
            submittedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            views: 0
          }
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Submit failed'); }
      const doc = await res.json();
      setSuccess('Article published successfully!');
      setTimeout(() => router.push('/article/' + doc.$id), 1500);
    } catch (err: any) { setError(err.message || 'Submit failed'); }
    setSubmitting(false);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid rgba(196,30,58,0.15)', borderLeftColor: '#c41e3a', borderRadius: '50%', margin: '0 auto' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} div{animation:spin 1s linear infinite}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5' }}>
      <style>{\@keyframes spin{to{transform:rotate(360deg)}}\}</style>
      <header style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#c41e3a', color: 'white', padding: '12px 20px', borderBottom: '3px solid #f5c518', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/assets/logo.png" alt="KhabarDarjeeling" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span style={{ fontWeight: '800', fontSize: '18px' }}>खबर दार्जिलिङ</span>
          </Link>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <button style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Home</button>
            </Link>
            <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '15px' }}>{isDarkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
        {user && (
          <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', flexShrink: 0 }}>{getInitials(user?.name || 'KD')}</div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '15px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{user?.name}</div>
              <div style={{ fontSize: '13px', color: isDarkMode ? '#aaa' : '#666' }}>✏️ Publishing as contributor – posts go live immediately</div>
            </div>
          </div>
        )}

        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: isDarkMode ? '#fff' : '#c41e3a', marginBottom: '4px' }}>Create Post</h1>
          <p style={{ fontSize: '14px', color: isDarkMode ? '#aaa' : '#666', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #f5c518' }}>Share your story with the Darjeeling community</p>

          {success && <div style={{ padding: '14px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', marginBottom: '20px', fontWeight: '600' }}>✅ {success}</div>}
          {error && <div style={{ padding: '14px', backgroundColor: '#ffebee', color: '#c41e3a', borderRadius: '8px', marginBottom: '20px' }}>⚠️ {error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: isDarkMode ? '#ddd' : '#333' }}>Article Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Enter a compelling headline..." style={{ width: '100%', padding: '12px 14px', border: '1px solid ' + (isDarkMode ? '#444' : '#ddd'), borderRadius: '8px', fontSize: '16px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', boxSizing: 'border-box', outline: 'none' }} />
              <div style={{ textAlign: 'right', fontSize: '12px', color: isDarkMode ? '#666' : '#aaa', marginTop: '4px' }}>{title.length}/200</div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: isDarkMode ? '#ddd' : '#333' }}>Genre *</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ width: '100%', padding: '12px 14px', border: '1px solid ' + (isDarkMode ? '#444' : '#ddd'), borderRadius: '8px', fontSize: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', boxSizing: 'border-box' }}>
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: isDarkMode ? '#ddd' : '#333' }}>Location District *</label>
                <select value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)} style={{ width: '100%', padding: '12px 14px', border: '1px solid ' + (isDarkMode ? '#444' : '#ddd'), borderRadius: '8px', fontSize: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', boxSizing: 'border-box' }}>
                  {locationDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: isDarkMode ? '#ddd' : '#333' }}>Village/Area (Optional)</label>
                <input value={locationArea} onChange={(e) => setLocationArea(e.target.value)} placeholder='e.g. Limboo Busty, Darjeeling Town' style={{ width: '100%', padding: '12px 14px', border: '1px solid ' + (isDarkMode ? '#444' : '#ddd'), borderRadius: '8px', fontSize: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: isDarkMode ? '#ddd' : '#333' }}>Featured Image</label>
              <div style={{ border: '2px dashed ' + (isDarkMode ? '#444' : '#ddd'), borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer', backgroundColor: isDarkMode ? '#2a2a2a' : '#fafafa' }} onClick={() => document.getElementById('imageInput')?.click()}>
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px' }} />
                ) : (
                  <div>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>📷</div>
                    <p style={{ margin: 0, color: isDarkMode ? '#aaa' : '#666', fontSize: '14px' }}>Click to upload image</p>
                    <p style={{ margin: '4px 0 0', color: isDarkMode ? '#666' : '#aaa', fontSize: '12px' }}>PNG, JPG up to 10MB</p>
                  </div>
                )}
                <input id="imageInput" type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} style={{ display: 'none' }} />
              </div>
              {uploadingImage && <p style={{ color: '#c41e3a', fontSize: '13px', marginTop: '8px' }}>⏳ Uploading image...</p>}
              {imageFileId && !uploadingImage && <p style={{ color: '#2e7d32', fontSize: '13px', marginTop: '8px' }}>✅ Image ready</p>}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px', color: isDarkMode ? '#ddd' : '#333' }}>YouTube Video ID (Optional)</label>
              <input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="e.g. dQw4w9WgXcQ" style={{ width: '100%', padding: '12px 14px', border: '1px solid ' + (isDarkMode ? '#444' : '#ddd'), borderRadius: '8px', fontSize: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', boxSizing: 'border-box' }} />
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: isDarkMode ? '#666' : '#aaa' }}>Paste just the 11-character ID from YouTube URL</p>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff8e1', borderRadius: '8px', border: '1px solid #f5c518' }}>
              <input type="checkbox" checked={isContestEntry} onChange={(e) => setIsContestEntry(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>🏆 Submit as Contest Entry</div>
                <div style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#666', marginTop: '2px' }}>Enter this story in the Khabar Darjeeling Story Contest 2026</div>
              </div>
            </label>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <Link href="/" style={{ flex: 1, textDecoration: 'none' }}>
                <button type="button" style={{ width: '100%', padding: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f0f0f0', color: isDarkMode ? '#ddd' : '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' }}>Cancel</button>
              </Link>
              <button type="submit" disabled={submitting || uploadingImage} style={{ flex: 2, padding: '14px', backgroundColor: submitting ? '#999' : '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '15px' }}>
                {submitting ? '⏳ Publishing...' : '🚀 Publish Now'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
