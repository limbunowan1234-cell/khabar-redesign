'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const DB = 'Khabar_db';
const REELS_COLLECTION = 'reels';
const BUNNY_API_KEY = process.env.NEXT_PUBLIC_BUNNY_API_KEY || '';

const categories = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Politics', 'Sports', 'Culture', 'Entertainment', 'Tea Gardens', 'Tourism'];

export default function AdminReelsPanel() {
  const { user } = useAuthStore();
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [view, setView] = useState('list');
  const [formData, setFormData] = useState({ title: '', description: '', videoUrl: '', thumbnailUrl: '', category: 'Darjeeling', authorName: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadReels();
  }, []);

  async function loadReels() {
    try {
      const res = await fetch(
        ENDPOINT + '/databases/' + DB + '/collections/' + REELS_COLLECTION + '/documents?queries[]=' +
        encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })),
        { headers: H, credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        setReels(data.documents || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handlePublish() {
    if (!formData.title || !formData.description || !formData.videoUrl || !formData.authorName) {
      setError('All fields required');
      return;
    }
    setUploading(true);
    try {
      const res = await fetch(
        ENDPOINT + '/databases/' + DB + '/collections/' + REELS_COLLECTION + '/documents',
        {
          method: 'POST',
          headers: HJ,
          credentials: 'include',
          body: JSON.stringify({
            documentId: 'unique()',
            title: formData.title,
            description: formData.description,
            videoUrl: formData.videoUrl,
            thumbnailUrl: formData.thumbnailUrl,
            category: formData.category,
            authorName: formData.authorName,
            views: 0,
            likes: 0,
            status: 'published'
          })
        }
      );
      if (res.ok) {
        setFormData({ title: '', description: '', videoUrl: '', thumbnailUrl: '', category: 'Darjeeling', authorName: '' });
        setError('');
        setView('list');
        await loadReels();
      } else {
        const data = await res.json();
        setError(data.message || 'Publish failed');
      }
    } catch (e) {
      setError((e as any).message || 'Error');
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this reel?')) return;
    try {
      await fetch(
        ENDPOINT + '/databases/' + DB + '/collections/' + REELS_COLLECTION + '/documents/' + id,
        { method: 'DELETE', headers: H, credentials: 'include' }
      );
      await loadReels();
    } catch (e) { console.error(e); }
  }

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5', color: isDarkMode ? '#fff' : '#1a1a1a', padding: '20px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '800', margin: 0 }}>Manage Reels</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ backgroundColor: isDarkMode ? '#333' : '#ddd', color: isDarkMode ? '#fff' : '#1a1a1a', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>{isDarkMode ? 'Light' : 'Dark'}</button>
            <button onClick={() => setView(view === 'list' ? 'create' : 'list')} style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>{view === 'list' ? 'Upload Reel' : 'Back to List'}</button>
          </div>
        </div>

        {view === 'create' ? (
          <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>Publish Reel</h2>
            
            {error && <div style={{ padding: '12px 16px', backgroundColor: '#ffebee', color: '#c41e3a', borderRadius: '8px', marginBottom: '16px', fontWeight: '600' }}>{error}</div>}

            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Title</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Reel title" style={{ width: '100%', padding: '12px', border: '1px solid ' + (isDarkMode ? '#333' : '#ddd'), borderRadius: '8px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Reel description" rows={3} style={{ width: '100%', padding: '12px', border: '1px solid ' + (isDarkMode ? '#333' : '#ddd'), borderRadius: '8px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Video URL (from BunnyCDN)</label>
                <input type="text" value={formData.videoUrl} onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })} placeholder="e.g., video1.mp4" style={{ width: '100%', padding: '12px', border: '1px solid ' + (isDarkMode ? '#333' : '#ddd'), borderRadius: '8px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', fontSize: '14px', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>Full URL: https://gorkhareels.b-cdn.net/{formData.videoUrl}</div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Thumbnail URL (optional)</label>
                <input type="text" value={formData.thumbnailUrl} onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })} placeholder="e.g., thumb1.jpg" style={{ width: '100%', padding: '12px', border: '1px solid ' + (isDarkMode ? '#333' : '#ddd'), borderRadius: '8px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Category</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', padding: '12px', border: '1px solid ' + (isDarkMode ? '#333' : '#ddd'), borderRadius: '8px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', fontSize: '14px', boxSizing: 'border-box' }}>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>Author Name</label>
                <input type="text" value={formData.authorName} onChange={(e) => setFormData({ ...formData, authorName: e.target.value })} placeholder="Author name" style={{ width: '100%', padding: '12px', border: '1px solid ' + (isDarkMode ? '#333' : '#ddd'), borderRadius: '8px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff', color: isDarkMode ? '#fff' : '#1a1a1a', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <button onClick={handlePublish} disabled={uploading} style={{ padding: '12px 24px', backgroundColor: uploading ? '#999' : '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '16px' }}>
                {uploading ? 'Publishing...' : 'Publish Reel'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {reels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: isDarkMode ? '#666' : '#ccc' }}>
                <p>No reels yet</p>
              </div>
            ) : (
              reels.map(reel => (
                <div key={reel.$id} style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <div style={{ width: '100px', height: '100px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                    🎬
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700' }}>{reel.title}</h3>
                    <p style={{ margin: '0 0 10px', fontSize: '13px', color: isDarkMode ? '#aaa' : '#666', lineHeight: '1.4' }}>{reel.description}</p>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: isDarkMode ? '#999' : '#888' }}>
                      <span>{reel.category}</span>
                      <span>•</span>
                      <span>{reel.views || 0} views</span>
                      <span>•</span>
                      <span>{reel.likes || 0} likes</span>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(reel.$id)} style={{ backgroundColor: '#ffebee', color: '#c41e3a', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap' }}>Delete</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}