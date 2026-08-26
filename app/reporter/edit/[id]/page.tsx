'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { getWorkerAuthToken } from '@/lib/appwrite';

async function toUploadableJpeg(file: File): Promise<File> {
  // Appwrite's storage preview/transform endpoint can't read AVIF/HEIC
  // source files (it silently falls back to a generic file-icon
  // placeholder), so re-encode every upload to JPEG before it lands there.
  const compressed = await imageCompression(file, { maxSizeMB: 8, maxWidthOrHeight: 2400, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85 });
  return new File([compressed], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };
const dbId = 'Khabar_db';
const ADMIN_EMAIL = 'nowanad@gmail.com';
// Week 34 of the Cloudflare migration (see cloudflare/README.md):
// saving an edit writes to D1 directly now -- Appwrite's articles
// collection is frozen as of this cutover. Week 39: image upload and
// preview both go through the Worker's R2-backed /cdn/articles too.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const genres = ['Voice of People', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Health', 'Education', 'Technology', 'Sports', 'Business'];
const locationDistricts = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];

interface SupportingImage {
  fileId: string;
  caption: string;
  preview: string;
}

export default function ReporterEditPage() {
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
        if (!res.ok) { setError('Please log in.'); setLoading(false); return; }
        const data = await res.json();
        const labels = (data as any).labels || [];
        const userIsAdmin = data.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
        const userIsReporter = userIsAdmin || labels.includes('reporter');
        if (!userIsReporter) { setError('Access denied. Reporter or Admin only.'); setLoading(false); return; }
        setUser(data);

        const artRes = await fetch(WORKER_URL + '/articles/' + articleId);
        if (!artRes.ok) { setError('Article not found.'); setLoading(false); return; }
        const article = await artRes.json();

        if (!userIsAdmin && article.submitterId !== data.$id) {
          setError('You can only edit your own articles.');
          setLoading(false);
          return;
        }

        setTitle(article.title || '');
        setSideHeader(article.sideHeader || '');
        setContent(article.content || '');
        setGenre(article.genre || 'Voice of People');
        setLocationDistrict(article.locationDistrict || 'Darjeeling');
        setLocationArea(article.locationArea || '');
        setYoutubeId(article.youtube_id || '');
        setIsBreaking(!!article.isBreaking);
        setIsFeatured(!!article.isFeatured);
        setImageFileId(article.imageFileId || '');
        setImageCaption(article.imageCaption || '');
        if (article.imageFileId) {
          setImagePreview(WORKER_URL + '/cdn/articles/' + article.imageFileId);
        }
        const parsedSupporting = (article.supportingImages || []).map((s: string) => {
          try {
            const parsed = JSON.parse(s);
            return { fileId: parsed.fileId, caption: parsed.caption || '', preview: WORKER_URL + '/cdn/articles/' + parsed.fileId };
          } catch {
            return null;
          }
        }).filter(Boolean);
        setSupportingImages(parsedSupporting);
      } catch {
        setError('Failed to load.');
      }
      setLoading(false);
    }
    load();
  }, [articleId]);

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
    if (!title.trim() || !content.trim()) { setError('Title and content are required.'); return; }
    if (content.trim().length < 100) { setError('Content must be at least 100 characters.'); return; }
    setSubmitting(true);
    try {
      const supportingImagesData = supportingImages.map((img) => JSON.stringify({ fileId: img.fileId, caption: img.caption }));
      const editData = {
        title: title.trim(),
        sideHeader: sideHeader.trim() || null,
        content: content.trim(),
        genre,
        locationDistrict,
        locationArea: locationArea || null,
        imageFileId: imageFileId || null,
        imageCaption: imageCaption.trim() || null,
        youtube_id: youtubeId || null,
        isBreaking,
        isFeatured,
        supportingImages: supportingImagesData,
      };
      const workerToken = await getWorkerAuthToken();
      if (!workerToken) throw new Error('Not authenticated');
      const res = await fetch(WORKER_URL + '/articles/' + articleId, {
        method: 'PATCH', headers: { Authorization: 'Bearer ' + workerToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editData, supportingImages: supportingImages.map((img) => ({ fileId: img.fileId, caption: img.caption })) })
      });
      if (!res.ok) throw new Error('Save failed');
      setSuccess('Article updated successfully!');
      setTimeout(() => router.push('/article/' + articleId), 1500);
    } catch (err: any) {
      setError(err.message || 'Save failed');
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
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Edit Article</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '800px', margin: '0 auto', padding: '30px 20px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Main Header (Title) *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline of the story" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '18px', fontWeight: 700, boxSizing: 'border-box' }} />

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Side Header (Optional)</label>
          <input value={sideHeader} onChange={(e) => setSideHeader(e.target.value)} placeholder="Secondary/sub headline" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }} />

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Main Photo</label>
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

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Content *</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write the full article content..." rows={12} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '6px', fontSize: '15px', lineHeight: 1.6, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#888' }}>Formatting: <code>## </code> for a subheading, <code>**bold**</code> for bold, <code>&gt; </code> for a pull-quote, or a table as <code>| Col A | Col B |</code> rows.</p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '18px' }}>{content.length} characters (minimum 100)</p>

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '10px' }}>Supporting Photos (with captions)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
            {supportingImages.map((img, index) => (
              <div key={img.fileId} style={{ display: 'flex', gap: '12px', border: '1px solid #eee', borderRadius: '8px', padding: '10px', alignItems: 'flex-start' }}>
                <img src={img.preview} alt="" style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <input value={img.caption} onChange={(e) => updateCaption(index, e.target.value)} placeholder="Caption for this photo" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <button type="button" onClick={() => removeSupportingImage(index)} style={{ background: '#fee2e2', color: '#c41e3a', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>Remove</button>
              </div>
            ))}
          </div>
          <input id="supportingImageInput" type="file" accept="image/*" onChange={handleSupportingImageUpload} disabled={uploadingSupporting} style={{ display: 'none' }} />
          <label htmlFor="supportingImageInput" style={{ display: 'inline-block', background: '#f3f4f6', color: '#374151', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginBottom: '20px', border: '1px dashed #ccc' }}>
            {uploadingSupporting ? 'Uploading...' : '+ Add Supporting Photo'}
          </label>

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

          <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: '#374151', marginBottom: '6px' }}>YouTube Video ID (Optional)</label>
          <input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="e.g. dQw4w9WgXcQ" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '18px', fontSize: '14px', boxSizing: 'border-box' }} />

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
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}