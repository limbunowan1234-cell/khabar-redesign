'use client';

import { useState } from 'react';

const LABEL: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: '14px', color: '#1a1a1a', marginBottom: '6px' };
const INPUT: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '15px', boxSizing: 'border-box', fontFamily: 'inherit' };
const FIELD: React.CSSProperties = { marginBottom: '18px' };

const COMPLAINT_TYPES = ['Editorial', 'Platform', 'Privacy', 'Other'];
const RESOLUTIONS = ['Correction', 'Retraction / Takedown', 'Clarification', 'Apology', 'Other'];

export default function GrievanceForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [complaintType, setComplaintType] = useState('');
  const [articleUrl, setArticleUrl] = useState('');
  const [description, setDescription] = useState('');
  const [resolutions, setResolutions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function toggleResolution(r: string) {
    setResolutions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/grievance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, complaintType, articleUrl, description, resolutions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      setResult({ ok: true, message: "Your grievance has been submitted. We'll acknowledge it within 24 hours and aim to resolve it within 15 days." });
      setName(''); setEmail(''); setPhone(''); setComplaintType(''); setArticleUrl(''); setDescription(''); setResolutions([]);
    } catch (err: any) {
      setResult({ ok: false, message: err.message || 'Something went wrong. Please email grievance@khabardarjeeling.in directly.' });
    }
    setSubmitting(false);
  }

  return (
    <>
      {result && (
        <div style={{ padding: '14px 16px', borderRadius: '10px', marginBottom: '20px', background: result.ok ? '#e8f5e9' : '#ffebee', color: result.ok ? '#2e7d32' : '#c41e3a', fontSize: '14px', fontWeight: 600 }}>
          {result.message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={FIELD}>
          <label style={LABEL}>Name *</label>
          <input style={INPUT} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div style={FIELD}>
          <label style={LABEL}>Email *</label>
          <input style={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div style={FIELD}>
          <label style={LABEL}>Phone</label>
          <input style={INPUT} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div style={FIELD}>
          <label style={LABEL}>Complaint Type *</label>
          <select style={INPUT} value={complaintType} onChange={(e) => setComplaintType(e.target.value)} required>
            <option value="" disabled>Select a type</option>
            {COMPLAINT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={FIELD}>
          <label style={LABEL}>Article URL (if applicable)</label>
          <input style={INPUT} type="url" placeholder="https://khabardarjeeling.in/article/..." value={articleUrl} onChange={(e) => setArticleUrl(e.target.value)} />
        </div>

        <div style={FIELD}>
          <label style={LABEL}>Description *</label>
          <textarea
            style={{ ...INPUT, minHeight: '160px', resize: 'vertical' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your complaint in detail (up to ~1000 words)."
            required
          />
        </div>

        <div style={FIELD}>
          <label style={LABEL}>Desired Resolution</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {RESOLUTIONS.map((r) => (
              <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#333' }}>
                <input type="checkbox" checked={resolutions.includes(r)} onChange={() => toggleResolution(r)} />
                {r}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{ width: '100%', padding: '14px', background: submitting ? '#999' : '#c41e3a', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700, cursor: submitting ? 'default' : 'pointer' }}
        >
          {submitting ? 'Submitting…' : 'Submit Grievance'}
        </button>
      </form>
    </>
  );
}
