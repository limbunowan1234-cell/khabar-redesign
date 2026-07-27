'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import imageCompression from 'browser-image-compression';

const CATEGORIES = [
  { value: 'poetry', label: 'ðŸŽ­ à¤•à¤¾à¤µà¥à¤¯' },
  { value: 'essay', label: 'ðŸ“š à¤¨à¤¿à¤¬à¤¨à¥à¤§' },
  { value: 'photo', label: 'ðŸ“· à¤«à¥‹à¤Ÿà¥‹' }
];

const S = {
  title: { fontSize: '26px', fontWeight: 700, color: '#b91c1c', marginBottom: '24px' },
  errorBox: { background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' },
  field: { marginBottom: '24px' },
  label: { display: 'block', fontWeight: 600, marginBottom: '8px', color: '#374151' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box' as const },
  textarea: { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '15px', minHeight: '150px', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  radioGroup: { display: 'flex', gap: '16px', flexWrap: 'wrap' as const },
  uploadBox: { border: '2px dashed #f87171', borderRadius: '8px', padding: '24px', textAlign: 'center' as const, background: '#fef2f2' },
  submitBtn: { width: '100%', background: '#b91c1c', color: 'white', fontWeight: 700, padding: '14px', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  charCount: { fontSize: '13px', color: '#9ca3af', marginTop: '4px' }
};

function radioLabel(active: boolean) {
  return {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
    border: active ? '2px solid #b91c1c' : '2px solid #d1d5db',
    background: active ? '#fef2f2' : 'white', borderRadius: '6px', cursor: 'pointer'
  };
}

export default function SubmissionForm({ onSuccess }: { onSuccess: () => void }) {
  const { user, isAuthenticated, loading: authLoading } = useAuthStore();
  const [formData, setFormData] = useState({ title: '', category: 'poetry', description: '', photo: null as File | null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [compressionProgress, setCompressionProgress] = useState('');

  if (authLoading) return <div style={{ textAlign: 'center', padding: '48px' }}>à¤²à¥‹à¤¡ à¤¹à¥‹ à¤°à¤¹à¥‡à¤•à¥‹ à¤›...</div>;
  if (!isAuthenticated || !user) return <div style={{ textAlign: 'center', padding: '48px' }}><p style={{ color: '#4b5563', fontSize: '18px' }}>à¤•à¥ƒà¤ªà¤¯à¤¾ à¤²à¤—à¤¿à¤¨ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥</p></div>;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) { setError('à¤«à¤¾à¤‡à¤² à¤†à¤•à¤¾à¤° à¥§ GB à¤­à¤¨à¥à¤¦à¤¾ à¤ à¥‚à¤²à¥‹ à¤›à¥¤'); return; }
    try {
      setCompressionProgress('à¤šà¤¿à¤¤à¥à¤° à¤¸à¤‚à¤•à¥à¤šà¤¿à¤¤ à¤—à¤°à¤¿à¤à¤¦à¥ˆà¤›...');
      const compressedFile = await imageCompression(file, { maxSizeMB: 30, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/webp' });
      setFormData(prev => ({ ...prev, photo: compressedFile }));
      setCompressionProgress('âœ“ à¤¸à¤‚à¤•à¥à¤šà¤¿à¤¤ à¤—à¤°à¤¿à¤à¤•à¥‹ (' + (compressedFile.size / (1024 * 1024)).toFixed(2) + ' MB)');
      setError('');
    } catch { setError('à¤šà¤¿à¤¤à¥à¤° à¤¸à¤‚à¤•à¥à¤šà¤¿à¤¤ à¤—à¤°à¥à¤¨ à¤…à¤¸à¤«à¤²'); setCompressionProgress(''); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!formData.title.trim()) { setError('à¤¶à¥€à¤°à¥à¤·à¤• à¤†à¤µà¤¶à¥à¤¯à¤• à¤›à¥¤'); setLoading(false); return; }
    if (!formData.description.trim()) { setError('à¤µà¤¿à¤µà¤°à¤£ à¤†à¤µà¤¶à¥à¤¯à¤• à¤›à¥¤'); setLoading(false); return; }
    if (formData.category === 'photo' && !formData.photo) { setError('à¤«à¥‹à¤Ÿà¥‹ à¤†à¤µà¤¶à¥à¤¯à¤• à¤›à¥¤'); setLoading(false); return; }

    try {
      const submitFormData = new FormData();
      submitFormData.append('title', formData.title);
      submitFormData.append('category', formData.category);
      submitFormData.append('description', formData.description);
      submitFormData.append('submitterName', user.name || 'Anonymous');
      submitFormData.append('submitterId', user.$id);
      if (formData.photo) submitFormData.append('photo', formData.photo);

      const response = await fetch('/api/bhasa-diwas/submit', { method: 'POST', body: submitFormData });
      const result = await response.json();
      if (!response.ok) { setError(result.error || 'à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤—à¤°à¥à¤¨ à¤…à¤¸à¤«à¤²'); setLoading(false); return; }

      setFormData({ title: '', category: 'poetry', description: '', photo: null });
      setCompressionProgress('');
      onSuccess();
    } catch (err) { setError('à¤¤à¥à¤°à¥à¤Ÿà¤¿: ' + (err instanceof Error ? err.message : 'Unknown')); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={S.title}>à¤…à¤ªà¤¨à¥‹ à¤°à¤šà¤¨à¤¾ à¤¸à¤¾à¤à¤¾ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥</h2>
      {error && <div style={S.errorBox}>{error}</div>}

      <div style={S.field}>
        <label style={S.label}>à¤¶à¥€à¤°à¥à¤·à¤• *</label>
        <input type="text" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} style={S.input} maxLength={200} />
        <p style={S.charCount}>{formData.title.length}/200</p>
      </div>

      <div style={S.field}>
        <label style={S.label}>à¤µà¤°à¥à¤— *</label>
        <div style={S.radioGroup}>
          {CATEGORIES.map(cat => (
            <label key={cat.value} style={radioLabel(formData.category === cat.value)}>
              <input type="radio" value={cat.value} checked={formData.category === cat.value} onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))} />
              {cat.label}
            </label>
          ))}
        </div>
      </div>

      <div style={S.field}>
        <label style={S.label}>à¤µà¤¿à¤µà¤°à¤£ *</label>
        <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} style={S.textarea} maxLength={2000} />
        <p style={S.charCount}>{formData.description.length}/2000</p>
      </div>

      {formData.category === 'photo' && (
        <div style={S.field}>
          <label style={S.label}>à¤«à¥‹à¤Ÿà¥‹ à¤…à¤ªà¤²à¥‹à¤¡ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥ *</label>
          <div style={S.uploadBox}>
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} id="photo-input" />
            <label htmlFor="photo-input" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>ðŸ“·</div>
              <p style={{ fontWeight: 600, color: '#b91c1c', margin: '0 0 4px' }}>{formData.photo ? formData.photo.name : 'à¤«à¥‹à¤Ÿà¥‹ à¤›à¤¾à¤¨à¥à¤¨à¥à¤¹à¥‹à¤¸à¥'}</p>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>à¤…à¤§à¤¿à¤•à¤¤à¤® à¥©à¥¦ MB (à¥§ GB à¤¸à¥à¤µà¤šà¤¾à¤²à¤¿à¤¤ à¤¸à¤‚à¤•à¥à¤šà¤¿à¤¤ à¤¹à¥à¤¨à¥‡à¤›)</p>
            </label>
            {compressionProgress && <p style={{ color: '#15803d', marginTop: '8px' }}>{compressionProgress}</p>}
          </div>
        </div>
      )}

      <button type="submit" disabled={loading} style={{ ...S.submitBtn, opacity: loading ? 0.6 : 1 }}>
        {loading ? 'à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤—à¤°à¤¿à¤à¤¦à¥ˆà¤›...' : 'à¤¸à¤¬à¤®à¤¿à¤Ÿ à¤—à¤°à¥à¤¨à¥à¤¹à¥‹à¤¸à¥'}
      </button>
    </form>
  );
}