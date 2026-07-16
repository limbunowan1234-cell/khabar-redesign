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
  const [totalArticleCount, setTotalArticleCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [photoType, setPhotoType] = useState('story');
  const [photoTitle, setPhotoTitle] = useState('');
  const [photos, setPhotos] = useState<any[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [postingStory, setPostingStory] = useState(false);
  const [storyTitle, setStoryTitle] = useState('');
  const [coverPhotoId, setCoverPhotoId] = useState('');
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
  const [trackerTitle, setTrackerTitle] = useState('');
  const [trackerLines, setTrackerLines] = useState('');
  const [weeklyPicks, setWeeklyPicks] = useState<any[]>([]);
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
      if (res.ok) { const data = await res.json(); setArticles(data.documents || []); setTotalArticleCount(data.total || 0); }
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


  function togglePhotoSelect(photoId: string) {
    setSelectedPhotoIds(prev => prev.includes(photoId) ? prev.filter(id => id !== photoId) : [...prev, photoId]);
  }

  async function handlePostAsArticle() {
    if (selectedPhotoIds.length === 0) { setError('Select at least one photo'); return; }
    if (!storyTitle.trim()) { setError('Enter a title for the story'); return; }
    setPostingStory(true);
    setError('');
    try {
      const selectedPhotos = photos.filter((p: any) => selectedPhotoIds.includes(p.$id));
      const coverPhoto = selectedPhotos.find((p: any) => p.$id === coverPhotoId) || selectedPhotos[0];
      const mainImageId = coverPhoto.imageFileId;
      const galleryIds = selectedPhotos.filter((p: any) => p.$id !== coverPhoto.$id).map((p: any) => p.imageFileId);
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents', {
        method: 'POST', headers: HJ, credentials: 'include',
        body: JSON.stringify({
          documentId: 'unique()',
          data: {
            title: storyTitle,
            content: 'A photo story from Khabar Darjeeling featuring ' + selectedPhotos.length + ' images.',
            category: 'Photo Story',
            location: 'Darjeeling',
            imageFileId: mainImageId,
            galleryImageIds: galleryIds,
            youtube_id: null,
            isBreaking: false, isFeatured: false, isContestEntry: false,
            authorName: user?.name || 'Khabar Darjeeling',
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
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed to post story'); }
      setSuccess('Photo story posted as article!');
      setSelectedPhotoIds([]); setCoverPhotoId(''); setCoverPhotoId('');
      setStoryTitle('');
    } catch (err: any) { setError(err.message || 'Failed to post story'); }
    setPostingStory(false);
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

  async function handleBackfillSlugs() {
    if (!confirm('Generate slugs for all articles missing one? This may take a moment.')) return;
    setError(''); setSuccess('');
    try {
      let updated = 0;
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents?queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [500] })), { headers: H, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const all = data.documents || [];
        for (const a of all) {
          if (a.slug) continue;
          const base = (a.title || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[^\x00-\x7F]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 60)
            .replace(/^-+|-+$/g, '');
          const slug = (base ? base + '-' : 'news-') + Date.now().toString(36) + Math.floor(Math.random() * 1000);
          await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + a.$id, {
            method: 'PATCH', headers: HJ, credentials: 'include',
            body: JSON.stringify({ data: { slug } })
          });
          updated++;
        }
      }
      setSuccess('Generated slugs for ' + updated + ' articles!');
      await loadArticles();
    } catch (err: any) { setError(err.message || 'Backfill failed'); }
  }

  function getTimeUntilSunday(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const dayOfWeek = istNow.getUTCDay();
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  const nextSunday = new Date(istNow);
  nextSunday.setUTCDate(istNow.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(0, 0, 0, 0);
  if (daysUntilSunday === 0 && istNow.getUTCHours() < 1) {
    return 'Publishing today';
  }
  const target = daysUntilSunday === 0 ? new Date(nextSunday.getTime() + 7 * 24 * 60 * 60 * 1000) : nextSunday;
  const diffMs = target.getTime() - istNow.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return days + 'd ' + hours + 'h until publish';
}

function parseTracker(title: string, lines: string): string {
  if (!title.trim() && !lines.trim()) return '';
  const items = lines.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const parts = l.split(':');
    const label = parts[0]?.trim() || '';
    const value = parts.slice(1).join(':').trim() || '';
    return { label, value };
  }).filter(item => item.label);
  if (items.length === 0 && !title.trim()) return '';
  return JSON.stringify({ title: title.trim() || 'Tracker', items });
}

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
      .replace(/^-+|-+$/g, '');
    const suffix = Date.now().toString(36);
    return (base ? base + '-' : 'news-') + suffix;
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
              slug: generateSlug(title),
              trackerData: parseTracker(trackerTitle, trackerLines),
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

  async function toggleWeeklyPick(articleId: string, currentValue: boolean) {
    try {
      let issueNum = null;
      let sectionName = '';
      if (!currentValue) {
        sectionName = prompt('Section name for this story (e.g. Community Voices, Ground Reports):', '') || 'Community Voices';
        const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'weeklyLive', values: [true] })) + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: 'weeklyIssue' }));
        const res = await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents?queries[]=' + q + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] })), { headers: H, credentials: 'include' });
        const data = await res.json();
        const highest = data.documents?.[0]?.weeklyIssue || 0;
        issueNum = highest + 1;
      }
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, {
        method: 'PATCH', headers: HJ, credentials: 'include',
        body: JSON.stringify({ data: { isWeeklyPick: !currentValue, weeklyIssue: !currentValue ? issueNum : null, weeklyLive: false, weeklySection: !currentValue ? sectionName : null } })
      });
      await loadArticles();
    } catch { setError('Weekly toggle failed'); }
  }

  async function publishWeeklyNow() {
    if (!confirm('Publish this issue right now? It will go live immediately.')) return;
    try {
      for (const a of weeklyPicks) {
        await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + a.$id, {
          method: 'PATCH', headers: HJ, credentials: 'include',
          body: JSON.stringify({ data: { weeklyLive: true } })
        });
      }
      alert('Issue published!');
      await loadWeeklyPicks();
    } catch { setError('Publish failed'); }
  }

  async function loadWeeklyPicks() {
    try {
      const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'isWeeklyPick', values: [true] })) + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'weeklyLive', values: [false] }));
      const res = await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents?queries[]=' + q + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderAsc', attribute: 'weeklyOrder' })), { headers: H, credentials: 'include' });
      const data = await res.json();
      setWeeklyPicks(data.documents || []);
    } catch { setError('Failed to load weekly picks'); }
  }

  async function moveWeeklyPick(articleId: string, direction: 'up' | 'down') {
    const idx = weeklyPicks.findIndex((a) => a.$id === articleId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= weeklyPicks.length) return;
    const a = weeklyPicks[idx];
    const b = weeklyPicks[swapIdx];
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + a.$id, { method: 'PATCH', headers: HJ, credentials: 'include', body: JSON.stringify({ data: { weeklyOrder: swapIdx } }) });
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + b.$id, { method: 'PATCH', headers: HJ, credentials: 'include', body: JSON.stringify({ data: { weeklyOrder: idx } }) });
      await loadWeeklyPicks();
    } catch { setError('Reorder failed'); }
  }

  async function changeSection(articleId: string) {
    const newSection = prompt('New section name:', '');
    if (!newSection) return;
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, { method: 'PATCH', headers: HJ, credentials: 'include', body: JSON.stringify({ data: { weeklySection: newSection } }) });
      await loadWeeklyPicks();
    } catch { setError('Section change failed'); }
  }

  async function setLeadStory(articleId: string) {
    try {
      for (const p of weeklyPicks) {
        if (p.isWeeklyLead) {
          await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + p.$id, { method: 'PATCH', headers: HJ, credentials: 'include', body: JSON.stringify({ data: { isWeeklyLead: false } }) });
        }
      }
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, { method: 'PATCH', headers: HJ, credentials: 'include', body: JSON.stringify({ data: { isWeeklyLead: true } }) });
      await loadWeeklyPicks();
    } catch { setError('Set lead failed'); }
  }

  async function removeFromWeekly(articleId: string) {
    if (!confirm('Remove this story from the Weekly?')) return;
    try {
      await fetch(endpoint + '/databases/' + dbId + '/collections/articles/documents/' + articleId, { method: 'PATCH', headers: HJ, credentials: 'include', body: JSON.stringify({ data: { isWeeklyPick: false, weeklyIssue: null, weeklySection: null, isWeeklyLead: false, weeklyOrder: 0 } }) });
      await loadWeeklyPicks();
    } catch { setError('Remove failed'); }
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
    try {
      const t = article.trackerData ? JSON.parse(article.trackerData) : null;
      setTrackerTitle(t?.title || '');
      setTrackerLines(t?.items ? t.items.map((it: any) => it.label + ': ' + it.value).join('\n') : '');
    } catch { setTrackerTitle(''); setTrackerLines(''); }
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
            trackerData: parseTracker(trackerTitle, trackerLines),
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
              <button onClick={() => { setView('weekly'); loadWeeklyPicks(); }} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', backgroundColor: view === 'weekly' ? '#D4AF37' : 'rgba(255,255,255,0.2)', color: view === 'weekly' ? '#0F4C5C' : 'white' }}>Weekly</button>
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
                { label: 'Total Articles', value: totalArticleCount, color: '#0F4C5C' },
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
              <button onClick={handleBackfillSlugs} style={{ width: '100%', padding: '12px', backgroundColor: '#0F4C5C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginBottom: '24px' }}>Generate Slugs for All Articles</button>

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
                      <button onClick={() => toggleWeeklyPick(article.$id, !!article.isWeeklyPick)} style={{ padding: '6px 12px', backgroundColor: article.isWeeklyPick ? '#7a1f1f' : '#f3e5f5', color: article.isWeeklyPick ? '#fff' : '#6a1b9a', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>{article.isWeeklyPick ? 'In Weekly' : 'Add to Weekly'}</button>
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
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Live Tracker Title (Optional)</label>
                  <input value={trackerTitle} onChange={(e) => setTrackerTitle(e.target.value)} placeholder="e.g. GTA Power Tracker" style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '10px' }} />
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Tracker Items (one per line: Label: Value)</label>
                  <textarea value={trackerLines} onChange={(e) => setTrackerLines(e.target.value)} placeholder="BGPM: 19 seats" rows={4} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
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
            {selectedPhotoIds.length > 0 && (
              <div style={{ backgroundColor: '#f0f4f5', border: '2px solid #0F4C5C', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 10px', fontWeight: '700', color: '#0F4C5C' }}>{selectedPhotoIds.length} photo(s) selected for story</p>
                <input type='text' value={storyTitle} onChange={(e) => setStoryTitle(e.target.value)} placeholder='Story title (e.g. Darjeeling Tea Festival 2026)' style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '10px' }} />
                <button onClick={handlePostAsArticle} disabled={postingStory} style={{ width: '100%', padding: '12px', backgroundColor: '#0F4C5C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', opacity: postingStory ? 0.7 : 1 }}>
                  {postingStory ? 'Posting...' : 'Post as Article'}
                </button>
              </div>
            )}

            <h3 style={{ color: '#0F4C5C', marginBottom: '16px' }}>Uploaded Photos ({photos.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
              {photos.map((p: any) => (
                <div key={p.$id} style={{ borderRadius: '10px', overflow: 'hidden', border: selectedPhotoIds.includes(p.$id) ? '3px solid #0F4C5C' : '1px solid #eee', position: 'relative' }}>
                  {p.type === 'story' && (
                    <input type='checkbox' checked={selectedPhotoIds.includes(p.$id)} onChange={() => togglePhotoSelect(p.$id)} style={{ position: 'absolute', top: '6px', left: '6px', width: '20px', height: '20px', zIndex: 5, cursor: 'pointer' }} />
                  )}
                  {p.type === 'story' && selectedPhotoIds.includes(p.$id) && (
                    <button onClick={() => setCoverPhotoId(p.$id)} style={{ position: 'absolute', top: '6px', right: '32px', width: '24px', height: '24px', borderRadius: '50%', border: 'none', backgroundColor: coverPhotoId === p.$id ? '#f5c518' : 'rgba(0,0,0,0.5)', color: coverPhotoId === p.$id ? '#1a1a1a' : '#fff', fontSize: '13px', cursor: 'pointer', zIndex: 5 }} title='Set as cover'>*</button>
                  )}
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
        {view === 'weekly' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ color: '#0F4C5C', marginBottom: '8px', borderBottom: '2px solid #D4AF37', paddingBottom: '10px' }}>Weekly Editor</h2>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>Draft picks for the next issue. Goes live automatically on Sunday.</p>
            <div style={{ display: 'inline-block', backgroundColor: '#fff3e0', color: '#e65100', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', marginBottom: '16px' }}>{getTimeUntilSunday()}</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button onClick={loadWeeklyPicks} style={{ padding: '8px 16px', backgroundColor: '#0F4C5C', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Refresh List</button>
              <a href='/weekly?preview=true' target='_blank' style={{ padding: '8px 16px', backgroundColor: '#D4AF37', color: '#0F4C5C', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', textDecoration: 'none', display: 'inline-block' }}>Preview Issue</a>
              <button onClick={publishWeeklyNow} style={{ padding: '8px 16px', backgroundColor: '#c41e3a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>Publish Now</button>
            </div>
            <p style={{ fontSize: '12px', color: weeklyPicks.length >= 4 && weeklyPicks.length <= 6 ? '#2e7d32' : '#e65100', fontWeight: '600', marginBottom: '16px' }}>{weeklyPicks.length} picks (recommended: 4-6)</p>
            {weeklyPicks.length === 0 ? (
              <p style={{ color: '#888', fontSize: '14px' }}>No picks yet. Go to Manage and click 'Add to Weekly' on articles.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {weeklyPicks.map((a: any, i: number) => (
                  <div key={a.$id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: a.isWeeklyLead ? '#fff8e1' : '#f9f9f9', borderRadius: '8px', border: a.isWeeklyLead ? '2px solid #D4AF37' : '1px solid #eee' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button onClick={() => moveWeeklyPick(a.$id, 'up')} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, fontSize: '14px' }}>Up</button>
                      <button onClick={() => moveWeeklyPick(a.$id, 'down')} disabled={i === weeklyPicks.length - 1} style={{ background: 'none', border: 'none', cursor: i === weeklyPicks.length - 1 ? 'default' : 'pointer', opacity: i === weeklyPicks.length - 1 ? 0.3 : 1, fontSize: '14px' }}>Down</button>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#1a1a1a', marginBottom: '4px' }}>{a.isWeeklyLead && 'LEAD - '}{a.title}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>Section: {a.weeklySection || 'None'}</div>
                    </div>
                    <button onClick={() => changeSection(a.$id)} style={{ padding: '6px 12px', backgroundColor: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Change Section</button>
                    {!a.isWeeklyLead && (
                      <button onClick={() => setLeadStory(a.$id)} style={{ padding: '6px 12px', backgroundColor: '#fff3e0', color: '#e65100', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Make Lead</button>
                    )}
                    <button onClick={() => removeFromWeekly(a.$id)} style={{ padding: '6px 12px', backgroundColor: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
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
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Live Tracker Title (Optional)</label>
                  <input value={trackerTitle} onChange={(e) => setTrackerTitle(e.target.value)} placeholder="e.g. GTA Power Tracker" style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box', marginBottom: '10px' }} />
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Tracker Items (one per line: Label: Value)</label>
                  <textarea value={trackerLines} onChange={(e) => setTrackerLines(e.target.value)} placeholder="BGPM: 19 seats" rows={4} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'monospace' }} />
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
