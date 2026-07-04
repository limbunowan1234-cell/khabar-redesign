'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const endpoint = 'https://api.khabardarjeeling.space/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const dbId = 'Khabar_db';
const bucketId = 'article-image';
const ADMIN_EMAIL = 'nowanad@gmail.com';

const categories = ['Darjeeling','Kalimpong','Kurseong','Mirik','Siliguri','West Bengal','Politics','Sports','Culture','Education','Health','Entertainment','Technology','Tea Gardens','Tourism','Crime','Opinion','Other'];

function getImageUrl(fileId: string) {
  return endpoint + '/storage/buckets/' + bucketId + '/files/' + fileId + '/view?project=' + projectId;
}

function formatDate(s: string) {
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; }
}

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [photoType, setPhotoType] = useState('story');
  const [photoTitle, setPhotoTitle] = useState('');
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState('manage');
  const [apkDownloads, setApkDownloads] = useState(0);
  const [editingArticle, setEditingArticle] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Darjeeling');
  const [location, setLocation] = useState('Darjeeling');
  const [youtubeId, setYoutubeId] = useState('');
  const [isBreaking, setIsBreaking] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isContestEntry, setIsContestEntry] = useState(false);
  const [imageFileId, setImageFileId] = useState('');
  const [imagePreview, setImagePreview] = useState('');

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
          await loadArticles();
          await loadApkDownloads();
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function loadArticles() {
    try {
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents?queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })) + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })), { headers: H, credentials: 'include' });
      if (res.ok) { const data = await res.json(); setArticles(data.documents || []); }
    } catch {}
  }

  async function loadApkDownloads() {
    try {
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/analytics/documents', { headers: H, credentials: 'include' });
      if (res.ok) { 
        const data = await res.json();
        const apkDoc = data.documents?.find((d: any) => d.$id === 'apk_downloads');
        if (apkDoc) setApkDownloads(apkDoc.count || 0);
      }
    } catch {}
  }

  async function trackApkDownload() {
    try {
      const newCount = apkDownloads + 1;
      await fetch(endpoint + '/databases/' + dbId + '/collections/analytics/documents/apk_downloads', {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({ data: { count: newCount } })
      });
      setApkDownloads(newCount);
      window.open('https://github.com/limbunowan1234-cell/Khabar-darjeeling/releases/download/v1.0.0/KhabarDarjeeling-v1.0.0.2.apk', '_blank');
    } catch {
      window.open('https://github.com/limbunowan1234-cell/Khabar-darjeeling/releases/download/v1.0.0/KhabarDarjeeling-v1.0.0.2.apk', '_blank');
    }
  }

  async function loadPhotos() {
    try {
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/photos/documents?queries[]=' +
        encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })) +
        '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
        { headers: H, credentials: 'include' }
      );
      if (res.ok) { const d = await res.json(); setPhotos(d.documents || []); }
    } catch {}
  }

  function getImageUrl2(fileId: string) {
    return endpoint + '/storage/buckets/' + bucketId + '/files/' + fileId + '/view?project=' + projectId;
  }

  async function handlePhotoUpload(e: any) {
    const files = Array.from(e.target.files) as File[];
    if (!files.length) return;
    setUploadingPhotos(true);
    setError('');
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) continue;
        setUploadProgress((i+1) + ' of ' + files.length);
        const formData = new FormData();
        formData.append('fileId', 'unique()');
        formData.append('file', file);
        const res = await fetch(endpoint + '/storage/buckets/' + bucketId + '/files', { method: 'POST', headers: H, credentials: 'include', body: formData });
        if (!res.ok) continue;
        const data = await res.json();
        await fetch(endpoint + '/databases/' + dbId + '/collections/photos/documents', {
          method: 'POST',
          headers: { ...H, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ documentId: 'unique()', data: { imageFileId: data.$id, type: photoType, title: photoTitle, createdAt: new Date().toISOString() } })
        });
      }
      setPhotoTitle('');
      await loadPhotos();
    } catch (err: any) { setError(err.message || 'Photo upload failed'); }
    setUploadingPhotos(false);
    setUploadProgress('');
  }

  async function handleDeletePhoto(photoId: string) {
    if (!confirm('Delete this photo?')) return;
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/photos/documents/' + photoId, { method: 'DELETE', headers: H, credentials: 'include' });
      await loadPhotos();
    } catch {}
  }

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
      setImagePreview(getImageUrl(data.$id));
      setSuccess('Image uploaded!');
    } catch (err: any) { setError('Upload failed: ' + err.message); setImagePreview(''); }
    setUploadingImage(false);
  }

  async function handlePublish(e: any) {
    e.preventDefault();
    if (!title || !content) { setError('Title and content required'); return; }
    if (content.length < 100) { setError('Content must be at least 100 characters'); return; }
    setPublishing(true); setError(''); setSuccess('');
    try {
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents', {
        method: 'POST', headers: HJ, credentials: 'include',
        body: JSON.stringify({
          documentId: 'unique()',
          data: {
            title, content, category, location: location || 'Darjeeling',
            imageFileId: imageFileId || null,
            youtube_id: youtubeId || null,
            isBreaking, isFeatured, isContestEntry,
            authorName: user?.name || 'Unknown',
            authorEmail: user?.email || '',
            submitterId: user?.$id || '',
            submitterName: user?.name || '',
            submitterEmail: user?.email || '',
            status: 'published',
            submittedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
            views: 0
          }
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Publish failed'); }
      setSuccess('Article published!');
      setTitle(''); setContent(''); setYoutubeId(''); setImageFileId(''); setImagePreview('');
      setIsBreaking(false); setIsFeatured(false); setIsContestEntry(false);
      await loadArticles();
      setView('manage');
    } catch (err: any) { setError(err.message || 'Publish failed'); }
    setPublishing(false);
  }

  async function handleDelete(articleId: string, title: string) {
    if (!confirm('Delete ' + title + '? This cannot be undone.')) return;
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, { method: 'DELETE', headers: H, credentials: 'include' });
      setArticles(articles.filter((a) => a.$id !== articleId));
      setSuccess('Article deleted!');
    } catch { setError('Delete failed'); }
  }

  async function handleEdit(article: any) {
    setEditingArticle(article);
    setTitle(article.title);
    setContent(article.content);
    setCategory(article.category);
    setLocation(article.location);
    setYoutubeId(article.youtube_id || '');
    setIsBreaking(article.isBreaking);
    setIsFeatured(article.isFeatured);
    setIsContestEntry(article.isContestEntry);
    setImageFileId(article.imageFileId);
    setImagePreview(article.imageFileId ? getImageUrl(article.imageFileId) : '');
    setView('edit');
  }

  async function handleSaveEdit(e: any) {
    e.preventDefault();
    if (!title || !content) { setError('Title and content required'); return; }
    if (content.length < 100) { setError('Content must be at least 100 characters'); return; }
    setPublishing(true); setError(''); setSuccess('');
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + editingArticle.$id, {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({
          data: {
            title, content, category, location: location || 'Darjeeling',
            imageFileId: imageFileId || null,
            youtube_id: youtubeId || null,
            isBreaking, isFeatured, isContestEntry
          }
        })
      });
      setSuccess('Article updated!');
      setEditingArticle(null);
      setTitle(''); setContent(''); setYoutubeId(''); setImageFileId(''); setImagePreview('');
      setIsBreaking(false); setIsFeatured(false); setIsContestEntry(false);
      await loadArticles();
      setView('manage');
    } catch (err: any) { setError(err.message || 'Update failed'); }
    setPublishing(false);
  }

  async function toggleFeatured(articleId: string, value: boolean) {
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({ data: { isFeatured: value } })
      });
      setArticles(articles.map((a) => a.$id === articleId ? { ...a, isFeatured: value } : a));
    } catch { setError('Update failed'); }
  }

  async function toggleBreaking(articleId: string, value: boolean) {
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({ data: { isBreaking: value } })
      });
      setArticles(articles.map((a) => a.$id === articleId ? { ...a, isBreaking: value } : a));
    } catch { setError('Update failed'); }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px' }}>Loading...</div>;

  if (!user) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ fontSize: '18px', marginBottom: '20px', color: '#c41e3a' }}>{error || 'Please login to access admin panel.'}</p>
      <Link href="/auth"><button style={{ backgroundColor: '#0F4C5C', color: 'white', padding: '12px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Login</button></Link>
    </div>
  );

  const filteredArticles = articles.filter((a) => {
    if (activeTab === 'breaking') return a.isBreaking;
    if (activeTab === 'featured') return a.isFeatured;
    if (activeTab === 'contest') return a.isContestEntry;
    return true;
  }).filter((a) => !search || a.title?.toLowerCase().includes(search.toLowerCase()));

  const totalViews = articles.reduce((s, a) => s + (a.views || 0), 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ backgroundColor: '#0F4C5C', color: 'white', padding: '16px 20px', borderBottom: '4px solid #D4AF37', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Link href="/"><button style={{ backgroundColor: 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '4px', display: 'block' }}>Back to Site</button></Link>
            <h1 style={{ margin: 0, fontSize: '20px' }}>KhabarDarjeeling Admin</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setView('manage')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', backgroundColor: view === 'manage' ? '#D4AF37' : 'rgba(255,255,255,0.2)', color: view === 'manage' ? '#0F4C5C' : 'white' }}>Manage</button>
            <button onClick={() => setView('publish')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', backgroundColor: view === 'publish' ? '#D4AF37' : 'rgba(255,255,255,0.2)', color: view === 'publish' ? '#0F4C5C' : 'white' }}>+ Publish</button>
              <button onClick={() => setView('photos')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', backgroundColor: view === 'photos' ? '#D4AF37' : 'rgba(255,255,255,0.2)', color: view === 'photos' ? '#0F4C5C' : 'white' }}>+ Photos</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px 16px' }}>
        {success && <div style={{ padding: '16px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', marginBottom: '20px', fontWeight: '600' }}>{success}</div>}
        {error && <div style={{ padding: '16px', backgroundColor: '#ffebee', color: '#c41e3a', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

        {view === 'manage' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {[
                { label: 'Total Articles', value: articles.length, color: '#0F4C5C' },
                { label: 'Total Views', value: totalViews.toLocaleString(), color: '#0F4C5C' },
                { label: 'APK Downloads', value: apkDownloads.toLocaleString(), color: '#27ae60' },
                { label: 'Breaking News', value: articles.filter(a => a.isBreaking).length, color: '#c41e3a' },
                { label: 'Featured', value: articles.filter(a => a.isFeatured).length, color: '#e65100' },
                { label: 'Contest Entries', value: articles.filter(a => a.isContestEntry).length, color: '#b8860b' },
              ].map((stat) => (
                <div key={stat.label} style={{ backgroundColor: 'white', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', borderLeft: '4px solid ' + stat.color }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <button onClick={trackApkDownload} style={{ width: '100%', padding: '14px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', marginBottom: '24px' }}>Download APK</button>

            <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '2px solid #ddd' }}>
              {['all', 'breaking', 'featured', 'contest'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '12px 24px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: activeTab === tab ? '#c41e3a' : '#666', borderBottom: activeTab === tab ? '3px solid #c41e3a' : '3px solid transparent', marginBottom: '-2px' }}>
                  {tab === 'all' ? 'All Articles' : tab === 'breaking' ? 'Breaking' : tab === 'featured' ? 'Featured' : 'Contest'}
                </button>
              ))}
            </div>

            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles by title..." style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' }} />

            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {filteredArticles.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>No articles found.</div>
              ) : (
                filteredArticles.map((article) => (
                  <div key={article.$id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: '16px', padding: '16px', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
                    {article.imageFileId ? (
                      <img src={getImageUrl(article.imageFileId)} alt="" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                    ) : (
                      <div style={{ width: '60px', height: '60px', backgroundColor: '#e0e0e0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>IMG</div>
                    )}
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#0F4C5C', marginBottom: '4px' }}>{article.title}</div>
                      <div style={{ fontSize: '12px', color: '#999', marginBottom: '6px' }}>By {article.submitterName || article.authorName || 'Unknown'} • {article.category} • {formatDate(article.$createdAt)} • {(article.views || 0).toLocaleString()} views</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {article.isBreaking && <span style={{ padding: '2px 8px', backgroundColor: '#ffebee', color: '#c41e3a', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>BREAKING</span>}
                        {article.isFeatured && <span style={{ padding: '2px 8px', backgroundColor: '#fff3e0', color: '#e65100', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>FEATURED</span>}
                        {article.isContestEntry && <span style={{ padding: '2px 8px', backgroundColor: '#fff8e1', color: '#b8860b', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>CONTEST</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => handleEdit(article)} style={{ padding: '6px 12px', backgroundColor: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Edit</button>
                      <button onClick={() => toggleFeatured(article.$id, !article.isFeatured)} style={{ padding: '6px 12px', backgroundColor: '#fff3e0', color: '#e65100', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{article.isFeatured ? 'Unfeature' : 'Feature'}</button>
                      <button onClick={() => toggleBreaking(article.$id, !article.isBreaking)} style={{ padding: '6px 12px', backgroundColor: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{article.isBreaking ? 'Unbreak' : 'Breaking'}</button>
                      <Link href={'/article/' + article.$id}><button style={{ padding: '6px 12px', backgroundColor: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', width: '100%' }}>View</button></Link>
                      <button onClick={() => handleDelete(article.$id, article.title)} style={{ padding: '6px 12px', backgroundColor: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {view === 'publish' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ color: '#0F4C5C', marginBottom: '24px', borderBottom: '2px solid #D4AF37', paddingBottom: '10px' }}>Publish New Article</h2>
            <form onSubmit={handlePublish} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article headline..." style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Darjeeling" style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Content * (min 100 chars)</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your article here..." rows={12} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6' }} />
                <div style={{ textAlign: 'right', fontSize: '12px', color: content.length < 100 ? '#c41e3a' : '#999', marginTop: '4px' }}>{content.length} characters</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Featured Image</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fafafa' }} />
                {uploadingImage && <p style={{ color: '#0F4C5C', marginTop: '8px', fontSize: '14px' }}>Uploading...</p>}
                {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginTop: '12px' }} />}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>YouTube Video ID (Optional)</label>
                <input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="e.g. dQw4w9WgXcQ" style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500' }}>
                  <input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Mark as Breaking News
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500' }}>
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Feature this article
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500' }}>
                  <input type="checkbox" checked={isContestEntry} onChange={(e) => setIsContestEntry(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Submit as Contest Entry
                </label>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setView('manage')} style={{ flex: 1, padding: '14px', backgroundColor: '#f0f0f0', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '16px' }}>Cancel</button>
                <button type="submit" disabled={publishing || uploadingImage} style={{ flex: 2, padding: '14px', backgroundColor: '#0F4C5C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', opacity: publishing ? 0.7 : 1 }}>
                  {publishing ? 'Publishing...' : 'Publish Article'}
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'photos' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ color: '#0F4C5C', marginBottom: '24px', borderBottom: '2px solid #D4AF37', paddingBottom: '10px' }}>Photo Management</h2>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>Photo Type</label>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <button type='button' onClick={() => setPhotoType('story')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: photoType === 'story' ? '2px solid #0F4C5C' : '1px solid #ddd', backgroundColor: photoType === 'story' ? '#0F4C5C' : 'white', color: photoType === 'story' ? 'white' : '#333', cursor: 'pointer', fontWeight: '600' }}>Photo Story</button>
                <button type='button' onClick={() => setPhotoType('ad')} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: photoType === 'ad' ? '2px solid #0F4C5C' : '1px solid #ddd', backgroundColor: photoType === 'ad' ? '#0F4C5C' : 'white', color: photoType === 'ad' ? 'white' : '#333', cursor: 'pointer', fontWeight: '600' }}>Ad Banner</button>
              </div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>Title (optional)</label>
              <input type='text' value={photoTitle} onChange={(e) => setPhotoTitle(e.target.value)} placeholder='e.g. Tea Garden Sunset' style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '16px' }} />
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>Upload Photos (select multiple)</label>
              <input type='file' accept='image/*' multiple onChange={handlePhotoUpload} disabled={uploadingPhotos} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fafafa' }} />
              {uploadingPhotos && <p style={{ color: '#0F4C5C', marginTop: '8px', fontSize: '14px' }}>Uploading {uploadProgress}...</p>}
            </div>
            <h3 style={{ color: '#0F4C5C', marginBottom: '16px' }}>Uploaded Photos ({photos.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
              {photos.map((p: any) => (
                <div key={p.$id} style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #eee', position: 'relative' }}>
                  <img src={getImageUrl2(p.imageFileId)} alt={p.title || 'Photo'} style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '8px', backgroundColor: '#fafafa' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: p.type === 'ad' ? '#c41e3a' : '#0F4C5C', textTransform: 'uppercase' }}>{p.type === 'ad' ? 'Ad Banner' : 'Photo Story'}</span>
                    {p.title && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#333' }}>{p.title}</p>}
                  </div>
                  <button onClick={() => handleDeletePhoto(p.$id)} style={{ position: 'absolute', top: '6px', right: '6px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', fontSize: '14px' }}>x</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'edit' && editingArticle && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ color: '#0F4C5C', marginBottom: '24px', borderBottom: '2px solid #D4AF37', paddingBottom: '10px' }}>Edit Article</h2>
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article headline..." style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Category *</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}>
                  {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Darjeeling" style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Content * (min 100 chars)</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your article here..." rows={12} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6' }} />
                <div style={{ textAlign: 'right', fontSize: '12px', color: content.length < 100 ? '#c41e3a' : '#999', marginTop: '4px' }}>{content.length} characters</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Featured Image</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fafafa' }} />
                {uploadingImage && <p style={{ color: '#0F4C5C', marginTop: '8px', fontSize: '14px' }}>Uploading...</p>}
                {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', marginTop: '12px' }} />}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>YouTube Video ID (Optional)</label>
                <input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="e.g. dQw4w9WgXcQ" style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500' }}>
                  <input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Mark as Breaking News
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500' }}>
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Feature this article
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: '500' }}>
                  <input type="checkbox" checked={isContestEntry} onChange={(e) => setIsContestEntry(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  Submit as Contest Entry
                </label>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setView('manage')} style={{ flex: 1, padding: '14px', backgroundColor: '#f0f0f0', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '16px' }}>Cancel</button>
                <button type="submit" disabled={publishing || uploadingImage} style={{ flex: 2, padding: '14px', backgroundColor: '#0F4C5C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '16px', opacity: publishing ? 0.7 : 1 }}>
                  {publishing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
