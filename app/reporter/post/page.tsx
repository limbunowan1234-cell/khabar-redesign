'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { getWorkerAuthToken } from '@/lib/appwrite';

async function toUploadableJpeg(file: File): Promise<File> {
  // Appwrite's storage preview/transform endpoint can't read AVIF/HEIC
  // source files (it silently falls back to a generic file-icon
  // placeholder), so re-encode every upload to JPEG before it lands there.
  const compressed = await imageCompression(file, { maxSizeMB: 8, maxWidthOrHeight: 2400, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85 });
  return new File([compressed], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

const endpoint = 'https://api.khabardarjeeling.in';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const dbId = 'Khabar_db';
// Week 34 of the Cloudflare migration (see cloudflare/README.md):
// publishing a new article writes to D1 directly now -- Appwrite's
// articles collection is frozen as of this cutover.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const ADMIN_EMAIL = 'nowanad@gmail.com';
const genres = ['Voice of People', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Health', 'Education', 'Technology', 'Sports', 'Business'];
const locationDistricts = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];

function generateSlug(title: string): string {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
  return base + '-' + Math.random().toString(36).slice(2, 10);
}

// Flash News (app 1.4.0): a short, photo-first post stored as an article
// with kind = 'flash'. The worker requires a photo and caps the
// description at 600 characters (cloudflare/src/routes/articles.ts).
const FLASH_MAX = 600;

type PostKind = 'story' | 'flash';

interface RecentStory {
  $id: string;
  title: string;
}

interface SupportingImage {
  fileId: string;
  caption: string;
  preview: string;
}

export default function ReporterPostPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [sideHeader, setSideHeader] = useState('');
  const [content, setContent] = useState('');
  const [genre, setGenre] = useState('Voice of People');
  const [locationDistrict, setLocationDistrict] = useState('Darjeeling');
  const [locationArea, setLocationArea] = useState('');
  const [youtubeId, setYoutubeId] = useState('');
  const [isBreaking, setIsBreaking] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  const [imageFileId, setImageFileId] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [uploadingMain, setUploadingMain] = useState(false);

  const [supportingImages, setSupportingImages] = useState<SupportingImage[]>([]);
  const [uploadingSupporting, setUploadingSupporting] = useState(false);

  const [kind, setKind] = useState<PostKind>('story');
  const [relatedArticleId, setRelatedArticleId] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [recentStories, setRecentStories] = useState<RecentStory[]>([]);
  const isFlash = kind === 'flash';

  // Recent stories for the Flash News "related story" picker. Loaded once,
  // the first time Flash mode is chosen.
  useEffect(() => {
    if (!isFlash || recentStories.length) return;
    fetch(WORKER_URL + '/articles?limit=30')
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((d) => setRecentStories((d.documents || []).map((a: any) => ({ $id: a.$id, title: a.title }))))
      .catch(() => {});
  }, [isFlash, recentStories.length]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(endpoint + '/auth/me', { headers: H, credentials: 'include' });
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
          setUser(data);
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

  async function handleMainImageUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMain(true);
    try {
      const jpeg = await toUploadableJpeg(file);
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const formData = new FormData();
      formData.append('file', jpeg);
      const res = await fetch(WORKER_URL + '/cdn/articles', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setImageFileId(data.fileId);
      setImagePreview(WORKER_URL + '/cdn/articles/' + data.fileId);
    } catch {
      setError('Main photo upload failed.');
    }
    setUploadingMain(false);
  }

  async function handleSupportingImageUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSupporting(true);
    try {
      const jpeg = await toUploadableJpeg(file);
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const formData = new FormData();
      formData.append('file', jpeg);
      const res = await fetch(WORKER_URL + '/cdn/articles', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      const preview = WORKER_URL + '/cdn/articles/' + data.fileId;
      setSupportingImages((prev) => [...prev, { fileId: data.fileId, caption: '', preview }]);
    } catch {
      setError('Supporting photo upload failed.');
    }
    setUploadingSupporting(false);
    e.target.value = '';
  }

  function updateCaption(index: number, caption: string) {
    setSupportingImages((prev) => prev.map((img, i) => (i === index ? { ...img, caption } : img)));
  }

  function removeSupportingImage(index: number) {
    setSupportingImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!title.trim() || !content.trim()) { setError(isFlash ? 'Headline and description are required.' : 'Title and content are required.'); return; }
    if (isFlash) {
      if (!imageFileId) { setError('Flash News needs a photo.'); return; }
      if (content.trim().length > FLASH_MAX) { setError(`Keep the Flash News description under ${FLASH_MAX} characters.`); return; }
    } else if (content.trim().length < 100) { setError('Content must be at least 100 characters.'); return; }
    setSubmitting(true);
    try {
      const supportingImagesData = isFlash ? [] : supportingImages.map((img) => JSON.stringify({ fileId: img.fileId, caption: img.caption }));
      const tags = tagsText.split(',').map((t) => t.trim()).filter(Boolean);
      const articleData = {
        kind,
        relatedArticleId: isFlash ? relatedArticleId || null : null,
        tags: isFlash && tags.length ? tags : undefined,
        title: title.trim(),
        sideHeader: isFlash ? null : sideHeader.trim() || null,
        content: content.trim(),
        slug: generateSlug(title),
        genre,
        locationDistrict,
        locationArea: locationArea || null,
        imageFileId: imageFileId || null,
        imageCaption: imageCaption.trim() || null,
        youtube_id: isFlash ? null : youtubeId || null,
        isBreaking,
        isFeatured,
        isContestEntry: false,
        supportingImages: supportingImagesData,
        authorName: user?.name || 'Khabar Reporter',
        authorEmail: user?.email || '',
        submitterId: user?.$id || '',
        submitterName: user?.name || '',
        submitterEmail: user?.email || '',
        submitterAvatar: null,
        status: 'published',
        submittedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
        views: 0
      };
      const workerToken = await getWorkerAuthToken();
      if (!workerToken) throw new Error('Not authenticated');
      const id = crypto.randomUUID();
      const res = await fetch(WORKER_URL + '/articles', {
        method: 'POST', headers: { Authorization: 'Bearer ' + workerToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...articleData, supportingImages: isFlash ? [] : supportingImages.map((img) => ({ fileId: img.fileId, caption: img.caption })) })
      });
      if (!res.ok) {
        // Show the worker's own message (missing photo, 600-character cap,
        // daily limit) instead of a generic failure.
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Submit failed');
      }
      setSuccess(isFlash ? 'Flash News published successfully!' : 'Article published successfully!');
      setTimeout(() => router.push('/article/' + id), 1500);
    } catch (err: any) {
      setError(err.message || 'Submit failed');
    }
    setSubmitting(false);
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px' }}>Loading...</div>;
  if (error && !user) return (
    <div style={{ textAlign: 'center', padding: '80px' }}>
      <p style={{ color: '#c41e3a', fontWeight: 700 }}>{error}</p>
      <Link href="/" style={{ color: '#c41e3a' }}>Back to Home</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F4C5C, #0a3540)', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Link href="/reporter" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>Back to Reporter Panel</Link>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>{isFlash ? 'Post Flash News (Reporter)' : 'Write Article (Reporter)'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '800px', margin: '0 auto', padding: '30px 20px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

          <div role="radiogroup" aria-label="Post type" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            {([['story', 'Story'], ['flash', '⚡ Flash News']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={kind === value}
                onClick={() => { setKind(value); setError(''); }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: kind === value ? '2px solid #c41e3a' : '1px solid #ddd', background: kind === value ? '#fff1f2' : 'white', color: kind === value ? '#c41e3a' : '#374151', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#6b7280' }}>
            {isFlash
              ? `A short photo update for the app's Flash feed and /flash: a photo, a headline and up to ${FLASH_MAX} characters, optionally linked to a full story.`
              : 'A full article with sub-headings and supporting photos.'}
          </p>

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>{isFlash ? 'Headline *' : 'Main Header (Title) *'}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isFlash ? 'Short headline for the update' : 'Headline of the story'} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '18px', fontWeight: 700, boxSizing: 'border-box' }} />

          {!isFlash && (
            <>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Side Header (Optional)</label>
              <input value={sideHeader} onChange={(e) => setSideHeader(e.target.value)} placeholder="Secondary/sub headline" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }} />
            </>
          )}

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>{isFlash ? 'Photo *' : 'Main Photo'}</label>
          <div style={{ border: '2px dashed #ccc', borderRadius: '8px', padding: '16px', textAlign: 'center', marginBottom: '18px' }}>
            {imagePreview ? (
              <img src={imagePreview} alt="Main" style={{ maxWidth: '100%', maxHeight: '240px', borderRadius: '8px', marginBottom: '10px' }} />
            ) : (
              <p style={{ color: '#9ca3af', marginBottom: '10px' }}>No main photo yet</p>
            )}
            <input id="mainImageInput" type="file" accept="image/*" onChange={handleMainImageUpload} disabled={uploadingMain} style={{ display: 'none' }} />
            <label htmlFor="mainImageInput" style={{ display: 'inline-block', background: '#0F4C5C', color: 'white', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              {uploadingMain ? 'Uploading...' : imageFileId ? 'Change Main Photo' : 'Upload Main Photo'}
            </label>
          </div>
          {imageFileId && (
            <input value={imageCaption} onChange={(e) => setImageCaption(e.target.value)} placeholder='Photo caption / credit (optional)' style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', marginTop: '10px', marginBottom: '18px', boxSizing: 'border-box' as const }} />
          )}

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>{isFlash ? 'Description *' : 'Content *'}</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={isFlash ? 'What happened, where and when, in a few lines...' : 'Write the full article content...'} rows={isFlash ? 5 : 12} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '6px', fontSize: '15px', lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          {isFlash ? (
            <p style={{ fontSize: '12px', color: content.trim().length > FLASH_MAX ? '#c41e3a' : '#9ca3af', fontWeight: content.trim().length > FLASH_MAX ? 700 : 400, marginBottom: '18px' }}>
              {content.trim().length} / {FLASH_MAX} characters
            </p>
          ) : (
            <>
              <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#888' }}>Formatting: <code>## </code> for a subheading, <code>**bold**</code> for bold, <code>&gt; </code> for a pull-quote, a table as <code>| Col A | Col B |</code> rows, or <code>[[image:2]]</code> on its own line to place supporting photo #2 exactly there (see the numbers below).</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '18px' }}>{content.length} characters (minimum 100)</p>
            </>
          )}

          {isFlash && (
            <>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Related Story (Optional)</label>
              <select value={relatedArticleId} onChange={(e) => setRelatedArticleId(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }}>
                <option value="">None</option>
                {recentStories.map((s) => <option key={s.$id} value={s.$id}>{s.title}</option>)}
              </select>

              <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Tags (Optional)</label>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="e.g. gangtok, traffic, weather (comma separated, up to 8)" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }} />
            </>
          )}

          {!isFlash && (<>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '10px' }}>Supporting Photos (with captions)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
            {supportingImages.map((img, index) => (
              <div key={img.fileId} style={{ display: 'flex', gap: '12px', border: '1px solid #eee', borderRadius: '8px', padding: '10px', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={img.preview} alt="" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} />
                  <span style={{ position: 'absolute', top: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>#{index + 1}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <input value={img.caption} onChange={(e) => updateCaption(index, e.target.value)} placeholder="Caption for this photo" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box' }} />
                  <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9ca3af' }}>Reference this photo in the content with <code>[[image:{index + 1}]]</code></p>
                </div>
                <button type="button" onClick={() => removeSupportingImage(index)} style={{ background: '#fee2e2', color: '#c41e3a', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>Remove</button>
              </div>
            ))}
          </div>
          <input id="supportingImageInput" type="file" accept="image/*" onChange={handleSupportingImageUpload} disabled={uploadingSupporting} style={{ display: 'none' }} />
          <label htmlFor="supportingImageInput" style={{ display: 'inline-block', background: '#f3f4f6', color: '#374151', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginBottom: '20px', border: '1px dashed #ccc' }}>
            {uploadingSupporting ? 'Uploading...' : '+ Add Supporting Photo'}
          </label>
          </>)}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Genre</label>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}>
                {genres.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>District</label>
              <select value={locationDistrict} onChange={(e) => setLocationDistrict(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }}>
                {locationDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Area / Locality (Optional)</label>
          <input value={locationArea} onChange={(e) => setLocationArea(e.target.value)} placeholder="e.g. Chowk Bazaar" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }} />

          {!isFlash && (
            <>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>YouTube Video ID (Optional)</label>
              <input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="e.g. dQw4w9WgXcQ" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }} />
            </>
          )}

          <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} /> Breaking News
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Featured
            </label>
          </div>

          {error && <div style={{ padding: '12px', background: '#fee2e2', color: '#c41e3a', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{error}</div>}
          {success && <div style={{ padding: '12px', background: '#dcfce7', color: '#15803d', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>{success}</div>}

          <button type="submit" disabled={submitting} style={{ width: '100%', padding: '14px', background: submitting ? '#999' : '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '16px', cursor: submitting ? 'default' : 'pointer' }}>
            {submitting ? 'Publishing...' : isFlash ? 'Publish Flash News' : 'Publish Article'}
          </button>
        </div>
      </form>
    </div>
  );
}
