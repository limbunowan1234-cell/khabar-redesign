'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { computeContestRankings, rankToCertRank, RankedEntry } from '@/lib/certRanking';
import { generateCertificateBlob, downloadBlob } from '@/lib/certGenerator';
import { getWorkerAuthToken } from '@/lib/appwrite';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const dbId = 'Khabar_db';
const bucketId = 'article-image';
const ADMIN_EMAIL = 'nowanad@gmail.com';
// Week 16+19+34 of the Cloudflare migration (see cloudflare/README.md):
// contest_settings, the article dashboard list, and every article write
// on this page (publish, edit, flag toggles, weekly-picks management,
// delete) all read/write through the Worker now -- Appwrite's articles
// collection is frozen as of this cutover.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

async function writeArticle(id: string, data: Record<string, any>, jwt: string | null) {
  if (!jwt) throw new Error('Not authenticated');
  const res = await fetch(`${WORKER_URL}/articles`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok) throw new Error('Create failed');
}

async function editArticle(id: string, data: Record<string, any>, jwt: string | null) {
  if (!jwt) throw new Error('Not authenticated');
  const res = await fetch(`${WORKER_URL}/articles/${id}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Update failed');
}

const genres = ['Voice of People', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Health', 'Education', 'Technology', 'Sports', 'Business'];
const locationDistricts = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];

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
  const [certRankings, setCertRankings] = useState<RankedEntry[]>([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certificatesLive, setCertificatesLive] = useState(false);
  const [publishing2, setPublishing2] = useState(false);

  async function loadCertRankings() {
    setCertLoading(true);
    try {
      const rankings = await computeContestRankings();
      setCertRankings(rankings);
      const sRes = await fetch(WORKER_URL + '/contest/settings');
      if (sRes.ok) { const sData = await sRes.json(); setCertificatesLive(!!sData.certificatesLive); }
    } catch (e) { console.error(e); }
    setCertLoading(false);
  }

  async function togglePublishCertificates() {
    setPublishing2(true);
    try {
      const newVal = !certificatesLive;
      const jwtRes = await fetch(endpoint + '/account/jwt', { method: 'POST', headers: H, credentials: 'include' });
      if (!jwtRes.ok) throw new Error('Could not verify admin session.');
      const { jwt } = await jwtRes.json();
      const res = await fetch('/api/admin/contest/publish-certificates', {
        method: 'POST',
        headers: { 'x-admin-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ live: newVal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update publish status');
      setCertificatesLive(newVal);
      setSuccess(newVal ? 'Certificates are now live for all participants!' : 'Certificates unpublished.');
    } catch (e: any) { setError(e?.message || 'Failed to update publish status'); }
    setPublishing2(false);
  }

  async function previewCertificate(entry: RankedEntry) {
    try {
      const rank = rankToCertRank(entry.rank);
      const blob = await generateCertificateBlob(entry.submitterName, rank);
      downloadBlob(blob, entry.submitterName.replace(/\s+/g, '_') + '_certificate.png');
    } catch (e) { setError('Failed to generate certificate preview'); }
  }

  const [apkDownloads, setApkDownloads] = useState(0);
  const [editingArticle, setEditingArticle] = useState<any>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [genre, setGenre] = useState('Voice of People');
  const [listPage, setListPage] = useState(0);
  const [locationDistrict, setLocationDistrict] = useState('Darjeeling');
  const [locationArea, setLocationArea] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [trackerTitle, setTrackerTitle] = useState('');
  const [trackerLines, setTrackerLines] = useState('');
  const [weeklyPicks, setWeeklyPicks] = useState<any[]>([]);
  const [isBreaking, setIsBreaking] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isContestEntry, setIsContestEntry] = useState(false);
  const [imageFileId, setImageFileId] = useState('');
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [imageCaption, setImageCaption] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const labels = (data as any).labels || [];
          const userIsAdmin = data.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
          const userIsReporter = userIsAdmin || labels.includes('reporter');
          if (!userIsReporter) {
            setError('Access denied. Reporter or Admin only.');
            setLoading(false);
            return;
          }
          setIsAdminUser(userIsAdmin);
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
      const token = await getWorkerAuthToken();
      const init = token ? { headers: { Authorization: 'Bearer ' + token } } : undefined;
      const res = await fetch(WORKER_URL + '/articles?status=all&limit=100', init);
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
      const articleData = {
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
      };
      const workerToken = await getWorkerAuthToken();
      const id = crypto.randomUUID();
      await writeArticle(id, articleData, workerToken);
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
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N}\s-]/gu, '')
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
      const articleData = {
        title, content, genre, locationDistrict, locationArea: locationArea || null,
          slug: generateSlug(title),
          trackerData: parseTracker(trackerTitle, trackerLines),
        imageFileId: imageFileId || null,
        imageCaption: imageCaption.trim() || null,
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
      };
      const workerToken = await getWorkerAuthToken();
      const id = crypto.randomUUID();
      await writeArticle(id, articleData, workerToken);
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
        const res = await fetch(WORKER_URL + '/articles?weeklyLive=1&sort=weeklyIssueDesc&limit=1');
        const data = await res.json();
        const highest = Number(data.documents?.[0]?.weeklyIssue) || 0;
        issueNum = highest + 1;
      }
      const weeklyData = { isWeeklyPick: !currentValue, weeklyIssue: !currentValue ? issueNum : null, weeklyLive: false, weeklySection: !currentValue ? sectionName : null };
      const workerToken = await getWorkerAuthToken();
      await editArticle(articleId, weeklyData, workerToken);
      await loadArticles();
    } catch { setError('Weekly toggle failed'); }
  }

  async function publishWeeklyNow() {
    if (!confirm('Publish this issue right now? It will go live immediately.')) return;
    try {
      const workerToken = await getWorkerAuthToken();
      for (const a of weeklyPicks) {
        await editArticle(a.$id, { weeklyLive: true }, workerToken);
      }
      alert('Issue published!');
      await loadWeeklyPicks();
    } catch { setError('Publish failed'); }
  }

  async function loadWeeklyPicks() {
    try {
      const res = await fetch(WORKER_URL + '/articles?isWeeklyPick=1&weeklyLive=0&sort=weeklyOrderAsc&limit=100');
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
      const workerToken = await getWorkerAuthToken();
      await editArticle(a.$id, { weeklyOrder: swapIdx }, workerToken);
      await editArticle(b.$id, { weeklyOrder: idx }, workerToken);
      await loadWeeklyPicks();
    } catch { setError('Reorder failed'); }
  }

  async function changeSection(articleId: string) {
    const newSection = prompt('New section name:', '');
    if (!newSection) return;
    try {
      const workerToken = await getWorkerAuthToken();
      await editArticle(articleId, { weeklySection: newSection }, workerToken);
      await loadWeeklyPicks();
    } catch { setError('Section change failed'); }
  }

  async function setLeadStory(articleId: string) {
    try {
      const workerToken = await getWorkerAuthToken();
      for (const p of weeklyPicks) {
        if (p.isWeeklyLead) {
          await editArticle(p.$id, { isWeeklyLead: false }, workerToken);
        }
      }
      await editArticle(articleId, { isWeeklyLead: true }, workerToken);
      await loadWeeklyPicks();
    } catch { setError('Set lead failed'); }
  }

  async function removeFromWeekly(articleId: string) {
    if (!confirm('Remove this story from the Weekly?')) return;
    try {
      const removeData = { isWeeklyPick: false, weeklyIssue: null, weeklySection: null, isWeeklyLead: false, weeklyOrder: 0 };
      const workerToken = await getWorkerAuthToken();
      await editArticle(articleId, removeData, workerToken);
      await loadWeeklyPicks();
    } catch { setError('Remove failed'); }
  }

  async function handleDelete(articleId: string, title: string) {
    if (!confirm('Delete ' + title + '? This cannot be undone.')) return;
    try {
      const workerToken = await getWorkerAuthToken();
      if (!workerToken) throw new Error('Not authenticated');
      const res = await fetch(`${WORKER_URL}/articles/${articleId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + workerToken } });
      if (!res.ok) throw new Error('Delete failed');
      setArticles(articles.filter((a) => a.$id !== articleId));
      setSuccess('Article deleted!');
    } catch { setError('Delete failed'); }
  }

  async function handleEdit(article: any) {
    setEditingArticle(article);
    setTitle(article.title);
    setContent(article.content || '');
    if (!article.content) { fetch(WORKER_URL + '/articles/' + article.$id).then(r => r.ok ? r.json() : null).then(d => { if (d) setContent(d.content || ''); }); }
    setGenre(genres.includes(article.genre) ? article.genre : (genres.includes(article.category) ? article.category : 'Voice of People'));
    setLocationDistrict(article.locationDistrict || 'Darjeeling'); setLocationArea(article.locationArea || article.location || '');
    setYoutubeId(article.youtube_id || '');
    setIsBreaking(article.isBreaking);
    setIsFeatured(article.isFeatured);
    setIsContestEntry(article.isContestEntry);
    setImageFileId(article.imageFileId);
    setImageCaption(article.imageCaption || '');
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
      const editData = {
        title, content, genre, locationDistrict, locationArea: locationArea || null,
        imageFileId: imageFileId || null,
        imageCaption: imageCaption.trim() || null,
        youtube_id: youtubeId || null,
        trackerData: parseTracker(trackerTitle, trackerLines),
        isBreaking, isFeatured, isContestEntry
      };
      const workerToken = await getWorkerAuthToken();
      await editArticle(editingArticle.$id, editData, workerToken);
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
      const workerToken = await getWorkerAuthToken();
      await editArticle(articleId, { isFeatured: value }, workerToken);
      setArticles(articles.map((a) => a.$id === articleId ? { ...a, isFeatured: value } : a));
    } catch { setError('Update failed'); }
  }

  async function toggleBreaking(articleId: string, value: boolean) {
    try {
      const workerToken = await getWorkerAuthToken();
      await editArticle(articleId, { isBreaking: value }, workerToken);
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

  const totalViews = articles.reduce((s: number, a: any) => s + (a.views || 0), 0);
  const filteredArticles = articles.filter((a) => {
    if (activeTab === 'breaking') return a.isBreaking;
    if (activeTab === 'featured') return a.isFeatured;
    if (activeTab === 'contest') return a.isContestEntry;
    return true;
  }).filter((a) => !search || a.title?.toLowerCase().includes(search.toLowerCase()));
  const pagedArticles = filteredArticles.slice(listPage * 10, listPage * 10 + 10);
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / 10));


  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F4C5C, #0a3540)', color: 'white', padding: '18px 20px', borderBottom: '4px solid #D4AF37', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ maxWidth: '1300px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <Link href="/"><button style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.75)', border: 'none', cursor: 'pointer', fontSize: '12px', marginBottom: '4px', display: 'block', padding: 0 }}>← Back to Site</button></Link>
            <h1 style={{ margin: 0, fontSize: '21px', fontWeight: 800, letterSpacing: '-0.3px' }}>Khabar Darjeeling Admin</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '2px' }}>
            <button onClick={() => setView('manage')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: view === 'manage' ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: view === 'manage' ? '#0F4C5C' : 'white' , whiteSpace: 'nowrap', flexShrink: 0, transition: 'background-color 0.15s' }}>📋 Manage</button>
            <button onClick={() => setView('publish')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: view === 'publish' ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: view === 'publish' ? '#0F4C5C' : 'white' , whiteSpace: 'nowrap', flexShrink: 0, transition: 'background-color 0.15s' }}>✍️ Publish</button>
              <button onClick={() => setView('photos')} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: view === 'photos' ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: view === 'photos' ? '#0F4C5C' : 'white' , whiteSpace: 'nowrap', flexShrink: 0, transition: 'background-color 0.15s' }}>📷 Photos</button>
              {isAdminUser && (
                <>
              <button onClick={() => { setView('weekly'); loadWeeklyPicks(); }} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: view === 'weekly' ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: view === 'weekly' ? '#0F4C5C' : 'white' , whiteSpace: 'nowrap', flexShrink: 0, transition: 'background-color 0.15s' }}>🗓️ Weekly</button>
                <button onClick={() => { setView('certificates'); loadCertRankings(); }} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: view === 'certificates' ? '#D4AF37' : 'rgba(255,255,255,0.12)', color: view === 'certificates' ? '#0F4C5C' : 'white', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background-color 0.15s' }}>🎓 Certificates</button>
                </>
              )}
                <Link href="/admin/bhasa-diwas"><button style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: '#b91c1c', color: 'white', whiteSpace: 'nowrap', flexShrink: 0 }}>🎭 Bhasa Diwas</button></Link>
                <Link href="/admin/curate"><button style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: 'rgba(255,255,255,0.12)', color: 'white', whiteSpace: 'nowrap', flexShrink: 0 }}>🧭 Curate</button></Link>
                <Link href="/admin/news-digest"><button style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: '#c41e3a', color: 'white', whiteSpace: 'nowrap', flexShrink: 0 }}>📰 News Digest</button></Link>
                <Link href="/admin/analytics"><button style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', backgroundColor: '#1a1a1a', color: 'white', whiteSpace: 'nowrap', flexShrink: 0 }}>📊 Analytics</button></Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '24px 16px' }}>
        {success && <div style={{ padding: '16px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', marginBottom: '20px', fontWeight: '600' }}>{success}</div>}
        {error && <div style={{ padding: '16px', backgroundColor: '#ffebee', color: '#c41e3a', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

        {view === 'manage' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '28px' }}>
              {[
                { label: 'Total Articles', value: totalArticleCount, color: '#0F4C5C', icon: '📰' },
                { label: 'Total Views', value: totalViews.toLocaleString(), color: '#0F4C5C', icon: '👁️' },
                { label: 'APK Downloads', value: apkDownloads.toLocaleString(), color: '#27ae60', icon: '📱' },
                { label: 'Breaking News', value: articles.filter(a => a.isBreaking).length, color: '#c41e3a', icon: '🔴' },
                { label: 'Featured', value: articles.filter(a => a.isFeatured).length, color: '#e65100', icon: '⭐' },
                { label: 'Contest Entries', value: articles.filter(a => a.isContestEntry).length, color: '#b8860b', icon: '🏆' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{ backgroundColor: 'white', borderRadius: '14px', padding: '18px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0', transition: 'transform 0.18s ease, box-shadow 0.18s ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)'; }}
                >
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: stat.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '12px' }}>{stat.icon}</div>
                  <div style={{ fontSize: '25px', fontWeight: '800', color: '#1a1a1a', letterSpacing: '-0.3px' }}>{stat.value}</div>
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '3px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '2px solid #ddd' }}>
              {['all', 'breaking', 'featured', 'contest'].map((tab) => (
                <button key={tab} onClick={() => { setListPage(0); setActiveTab(tab); }} style={{ padding: '12px 24px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px', color: activeTab === tab ? '#c41e3a' : '#666', borderBottom: activeTab === tab ? '3px solid #c41e3a' : '3px solid transparent', marginBottom: '-2px' }}>
                  {tab === 'all' ? 'All Articles' : tab === 'breaking' ? 'Breaking' : tab === 'featured' ? 'Featured' : 'Contest'}
                </button>
              ))}
            </div>

            <input value={search} onChange={(e) => { setSearch(e.target.value); setListPage(0); }} placeholder="Search articles by title..." style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' }} />

            <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {filteredArticles.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#999' }}>No articles found.</div>
              ) : (
                pagedArticles.map((article) => (
                  <div key={article.$id} style={{ display: 'grid', gridTemplateColumns: '70px 1fr auto', gap: '16px', padding: '16px', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
                    {article.imageFileId ? (
                      <img loading="lazy" src={getImageUrl(article.imageFileId)} alt="" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
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
            {totalPages > 1 && (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '16px 0' }}><button onClick={() => setListPage(Math.max(0, listPage - 1))} disabled={listPage === 0} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: listPage === 0 ? '#ddd' : '#0F4C5C', color: '#fff', cursor: listPage === 0 ? 'default' : 'pointer', fontWeight: 700 }}>&larr; Prev</button><span style={{ fontSize: '13px', fontWeight: 700, color: '#555' }}>Page {listPage + 1} of {totalPages}</span><button onClick={() => setListPage(Math.min(totalPages - 1, listPage + 1))} disabled={listPage >= totalPages - 1} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: listPage >= totalPages - 1 ? '#ddd' : '#0F4C5C', color: '#fff', cursor: listPage >= totalPages - 1 ? 'default' : 'pointer', fontWeight: 700 }}>Next &rarr;</button></div>)}
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
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Genre *</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}>
                  {genres.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Location</label>
                <select value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '8px', boxSizing: 'border-box' }}>{locationDistricts.map(d => <option key={d} value={d}>{d}</option>)}</select>
                <input value={locationArea} onChange={(e) => setLocationArea(e.target.value)} placeholder='Village/Area (optional)' style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Content * (min 100 chars)</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your article here..." rows={12} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6' }} />
                <div style={{ textAlign: 'right', fontSize: '12px', color: content.length < 100 ? '#c41e3a' : '#999', marginTop: '4px' }}>{content.length} characters</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Featured Image</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fafafa' }} />
                <input value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} placeholder='Photo caption / credit (optional)' style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', marginTop: '10px', boxSizing: 'border-box' as const }} />
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




      {view === 'certificates' && (
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#0F4C5C', marginBottom: '8px', borderBottom: '2px solid #D4AF37', paddingBottom: '10px' }}>Contest Certificates</h2>
          <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>Ranking is computed live from views, likes, and comments &mdash; same formula as the public leaderboard.</p>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button onClick={loadCertRankings} disabled={certLoading} style={{ padding: '10px 18px', backgroundColor: '#0F4C5C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              {certLoading ? 'Loading...' : 'Refresh Rankings'}
            </button>
            <button onClick={togglePublishCertificates} disabled={publishing2 || certRankings.length === 0} style={{ padding: '10px 18px', backgroundColor: certificatesLive ? '#c41e3a' : '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>
              {publishing2 ? 'Updating...' : certificatesLive ? 'Unpublish Certificates' : 'Publish Certificates'}
            </button>
            <span style={{ fontSize: '13px', fontWeight: '700', color: certificatesLive ? '#27ae60' : '#999', padding: '6px 12px', backgroundColor: certificatesLive ? '#e8f5e9' : '#f5f5f5', borderRadius: '20px' }}>
              {certificatesLive ? 'LIVE - contestants can download' : 'Not published yet'}
            </span>
          </div>

          {certRankings.length === 0 ? (
            <p style={{ color: '#999', padding: '20px 0' }}>Click "Refresh Rankings" to compute standings from contest entries.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                    <th style={{ padding: '10px' }}>Rank</th>
                    <th style={{ padding: '10px' }}>Name</th>
                    <th style={{ padding: '10px' }}>Article</th>
                    <th style={{ padding: '10px' }}>Score</th>
                    <th style={{ padding: '10px' }}>Certificate</th>
                    <th style={{ padding: '10px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {certRankings.map((entry) => (
                    <tr key={entry.articleId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px', fontWeight: '800', color: entry.rank <= 3 ? '#c41e3a' : '#666' }}>{entry.rank}</td>
                      <td style={{ padding: '10px', fontWeight: '600' }}>{entry.submitterName}</td>
                      <td style={{ padding: '10px', color: '#888', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.title}</td>
                      <td style={{ padding: '10px' }}>{entry.score.toFixed(1)}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', backgroundColor: entry.rank === 1 ? '#fff3d6' : entry.rank === 2 ? '#eef1f5' : entry.rank === 3 ? '#fbe6d6' : '#f0f0f0', color: entry.rank <= 3 ? '#7a5c00' : '#666' }}>
                          {rankToCertRank(entry.rank) === 'participation' ? 'Participation' : rankToCertRank(entry.rank).toUpperCase() + ' Place'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button onClick={() => previewCertificate(entry)} style={{ padding: '6px 12px', backgroundColor: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Preview</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Genre *</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '16px', boxSizing: 'border-box' }}>
                  {genres.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Location</label>
                <select value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '8px', boxSizing: 'border-box' }}>{locationDistricts.map(d => <option key={d} value={d}>{d}</option>)}</select>
                <input value={locationArea} onChange={(e) => setLocationArea(e.target.value)} placeholder='Village/Area (optional)' style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Content * (min 100 chars)</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your article here..." rows={12} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6' }} />
                <div style={{ textAlign: 'right', fontSize: '12px', color: content.length < 100 ? '#c41e3a' : '#999', marginTop: '4px' }}>{content.length} characters</div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Featured Image</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} style={{ width: '100%', padding: '12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', backgroundColor: '#fafafa' }} />
                <input value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} placeholder='Photo caption / credit (optional)' style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', marginTop: '10px', boxSizing: 'border-box' as const }} />
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
