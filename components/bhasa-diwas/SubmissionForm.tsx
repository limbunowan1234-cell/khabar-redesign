'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import imageCompression from 'browser-image-compression';
import { isBhasaDiwasClosed } from '@/lib/bhasaDiwas';

const CATEGORIES = [
  { value: 'poetry', label: '✍️ काव्य', maxWords: 2000, minWords: 0 },
  { value: 'essay', label: '📚 निबन्ध', maxWords: 5000, minWords: 0 },
];

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

const S = {
  title: { fontSize: '26px', fontWeight: 700, color: '#b91c1c', marginBottom: '16px' },
  rulesBox: { background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '20px', marginBottom: '24px' },
  rulesTitle: { fontSize: '15px', fontWeight: 700, color: '#92400e', marginBottom: '10px' },
  rulesList: { margin: 0, paddingLeft: '20px', color: '#78350f', fontSize: '13px', lineHeight: 1.8 },
  errorBox: { background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px' },
  field: { marginBottom: '24px' },
  label: { display: 'block', fontWeight: 600, marginBottom: '8px', color: '#374151' },
  input: { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '15px', boxSizing: 'border-box' as const },
  textarea: { width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '15px', minHeight: '150px', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  radioGroup: { display: 'flex', gap: '16px', flexWrap: 'wrap' as const },
  uploadBox: { border: '2px dashed #f87171', borderRadius: '8px', padding: '24px', textAlign: 'center' as const, background: '#fef2f2' },
  submitBtn: { width: '100%', background: '#b91c1c', color: 'white', fontWeight: 700, padding: '14px', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' },
  charCount: { fontSize: '13px', color: '#9ca3af', marginTop: '4px' },
  wordCountOk: { fontSize: '13px', color: '#15803d', marginTop: '4px', fontWeight: 600 },
  wordCountBad: { fontSize: '13px', color: '#b91c1c', marginTop: '4px', fontWeight: 600 }
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
  const isSubmittingRef = useRef(false);

  if (isBhasaDiwasClosed()) return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
      <p style={{ color: '#111827', fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>सबमिशन अवधि समाप्त भएको छ</p>
      <p style={{ color: '#4b5563', fontSize: '15px', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto' }}>
        सहभागिता जनाउनुभएकोमा हार्दिक धन्यवाद! विजेताहरूको नतिजा हेर्न "विजेता" ट्याबमा जानुहोस्।
      </p>
    </div>
  );

  if (authLoading) return <div style={{ textAlign: 'center', padding: '48px' }}>लोड हो रहेको छ...</div>;
  if (!isAuthenticated || !user) return (
    <div style={{ textAlign: 'center', padding: '48px' }}>
      <p style={{ color: '#4b5563', fontSize: '18px', marginBottom: '20px' }}>सबमिट गर्न लगिन वा साइन अप गर्नुहोस्</p>
      <Link href='/auth' style={{ display: 'inline-block', background: '#b91c1c', color: 'white', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700 }}>लगिन / साइन अप गर्नुहोस्</Link>
    </div>
  );

  const currentCategory = CATEGORIES.find(c => c.value === formData.category)!;
  const wordCount = countWords(formData.description);
  const wordCountValid = wordCount >= currentCategory.minWords && wordCount <= currentCategory.maxWords;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024 * 1024) { setError('फाइल आकार १ GB भन्दा ठूलो छ।'); return; }
    try {
      setCompressionProgress('चित्र संकुचित गरिँदैछ...');
      const compressedFile = await imageCompression(file, { maxSizeMB: 30, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/webp' });
      setFormData(prev => ({ ...prev, photo: compressedFile }));
      setCompressionProgress('✓ संकुचित गरिएको (' + (compressedFile.size / (1024 * 1024)).toFixed(2) + ' MB)');
      setError('');
    } catch { setError('चित्र संकुचित गर्न असफल'); setCompressionProgress(''); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    setLoading(true);
    setError('');

    if (!formData.title.trim()) { setError('शीर्षक आवश्यक छ।'); setLoading(false); isSubmittingRef.current = false; return; }
    if (!formData.description.trim()) { setError('विवरण आवश्यक छ।'); setLoading(false); isSubmittingRef.current = false; return; }
    if (formData.category === 'photo' && !formData.photo) { setError('फोटो आवश्यक छ।'); setLoading(false); isSubmittingRef.current = false; return; }

    const wc = countWords(formData.description);
    if (wc < currentCategory.minWords) {
      setError(`कम्तिमा ${currentCategory.minWords} शब्द आवश्यक छ। हाल ${wc} शब्द छ।`);
      setLoading(false); isSubmittingRef.current = false; return;
    }
    if (wc > currentCategory.maxWords) {
      setError(`अधिकतम ${currentCategory.maxWords} शब्द मात्र स्वीकार्य छ। हाल ${wc} शब्द छ।`);
      setLoading(false); isSubmittingRef.current = false; return;
    }

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
      if (!response.ok) { setError(result.error || 'सबमिट गर्न असफल'); setLoading(false); isSubmittingRef.current = false; return; }

      setFormData({ title: '', category: 'poetry', description: '', photo: null });
      setCompressionProgress('');
      onSuccess();
    } catch (err) {
      setError('त्रुटि: ' + (err instanceof Error ? err.message : 'Unknown'));
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 style={S.title}>अपनो रचना साझा गर्नुहोस्</h2>

      <div style={S.rulesBox}>
        <div style={S.rulesTitle}>⚠️ सबमिशन नियमहरू (Submission Rules)</div>
        <ul style={S.rulesList}>
          <li>काव्य (Poetry): अधिकतम २००० शब्द</li>
          <li>निबन्ध (Essay): अधिकतम ५००० शब्द</li>
          <li>केवल नेपाली भाषामा मात्र सबमिट गर्नुहोस् (Nepali language only)</li>
          <li>केवल आफ्नै मौलिक रचना - कुनै पनि किसिमको नक्कल/चोरी स्वीकार्य छैन</li>
          <li>अन्तिम मिति: अगस्ट १९, २०२६ (Deadline: August 19, 2026)</li>
        </ul>
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      <div style={S.field}>
        <label style={S.label}>शीर्षक *</label>
        <input type="text" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} style={S.input} maxLength={200} />
        <p style={S.charCount}>{formData.title.length}/200</p>
      </div>

      <div style={S.field}>
        <label style={S.label}>वर्ग *</label>
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
        <label style={S.label}>विवरण *</label>
        <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} style={S.textarea} maxLength={50000} />
        <p style={S.charCount}>{formData.description.length}/2000 अक्षर</p>
        <p style={wordCountValid ? S.wordCountOk : S.wordCountBad}>
          {wordCount} शब्द
          {currentCategory.minWords > 0 ? ` (कम्तिमा ${currentCategory.minWords}` : ' ('}
          {`, अधिकतम ${currentCategory.maxWords} शब्द)`}
        </p>
      </div>

      {formData.category === 'photo' && (
        <div style={S.field}>
          <label style={S.label}>फोटो अपलोड गर्नुहोस् *</label>
          <div style={S.uploadBox}>
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} id="photo-input" />
            <label htmlFor="photo-input" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📷</div>
              <p style={{ fontWeight: 600, color: '#b91c1c', margin: '0 0 4px' }}>{formData.photo ? formData.photo.name : 'फोटो छान्नुहोस्'}</p>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>अधिकतम ३० MB (१ GB स्वचालित संकुचित हुनेछ)</p>
            </label>
            {compressionProgress && <p style={{ color: '#15803d', marginTop: '8px' }}>{compressionProgress}</p>}
          </div>
        </div>
      )}

      <button type="submit" disabled={loading} style={{ ...S.submitBtn, opacity: loading ? 0.6 : 1 }}>
        {loading ? 'सबमिट गरिँदैछ...' : 'सबमिट गर्नुहोस्'}
      </button>
    </form>
  );
}



