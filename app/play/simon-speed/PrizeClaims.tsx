'use client';

import { useEffect, useState } from 'react';
import styles from './play.module.css';
import { WORKER_URL } from '@/lib/downloadCategories';
import { ApiError, errorMessage, getPlayerSession, playerFetch, type PlayerProfile } from '@/lib/player';

interface Claim { id: string; status: 'submitted' | 'paid'; upiId: string | null; submittedAt: string; paidAt: string | null }
interface Prize { mode: 'easy' | 'medium' | 'hard'; period: string; start: string; end: string; amount: number; score: number; claim: Claim | null }

const MODE_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

function day(date: string): string {
  const d = new Date(date.length === 10 ? date + 'T00:00:00Z' : date.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: date.length === 10 ? 'UTC' : 'Asia/Kolkata' });
}

// Shown to a logged-in player who won a finished round: upload the QR code
// of their UPI account (and optionally their UPI ID) so the prize can be
// sent. Nothing shows for anyone else.
export default function PrizeClaims({ player }: { player: PlayerProfile | null }) {
  const [prizes, setPrizes] = useState<Prize[]>([]);

  useEffect(() => {
    if (!player) { setPrizes([]); return; }
    playerFetch<{ prizes: Prize[] }>('/prizes/mine').then((d) => setPrizes(d.prizes)).catch(() => setPrizes([]));
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!player || prizes.length === 0) return null;

  return (
    <section className={styles.prizePanel} aria-label="Your prizes">
      {prizes.map((p) => (
        <PrizeCard key={p.period + p.mode} prize={p} onSaved={(claim) => setPrizes((all) => all.map((x) => (x === p ? { ...x, claim } : x)))} />
      ))}
    </section>
  );
}

function PrizeCard({ prize, onSaved }: { prize: Prize; onSaved: (claim: Claim) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [upiId, setUpiId] = useState(prize.claim?.upiId || '');
  const [editing, setEditing] = useState(!prize.claim);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = 'qr-' + prize.period + '-' + prize.mode;

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!file) return setError('Choose a photo or screenshot of your UPI QR code.');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('qr', file);
      form.append('upiId', upiId.trim());
      const res = await fetch(WORKER_URL + '/prizes/' + prize.period + '/' + prize.mode, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + (getPlayerSession()?.token || '') },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(data.error || 'Upload failed. Please try again.', res.status);
      onSaved(data.claim);
      setEditing(false);
      setFile(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const c = prize.claim;
  return (
    <div className={styles.prizeCard}>
      <div className={styles.prizeHead}>
        <span className={styles.trophy} aria-hidden="true">🏆</span>
        <div>
          <strong>You won ₹{prize.amount} in {MODE_LABEL[prize.mode]}!</strong>
          <span>#1 with {prize.score} points · round {day(prize.start)} – {day(prize.end)}</span>
        </div>
      </div>

      {c?.status === 'paid' ? (
        <p className={styles.prizeDone}>Paid on {day(c.paidAt || c.submittedAt)}. Congratulations!</p>
      ) : !editing && c ? (
        <div className={styles.prizeDone}>
          <p>Your QR code was received on {day(c.submittedAt)}{c.upiId ? ' (UPI ID ' + c.upiId + ')' : ''}. We&apos;ll send your prize soon.</p>
          <button type="button" className={styles.linkBtn} onClick={() => setEditing(true)}>Change QR code</button>
        </div>
      ) : (
        <form className={styles.prizeForm} onSubmit={submit}>
          <p>Upload the QR code of your UPI account (Google Pay, PhonePe, Paytm or your bank app) and we&apos;ll send ₹{prize.amount} to it.</p>
          <label htmlFor={inputId} className={styles.qrPick}>
            {preview ? <img src={preview} alt="Your QR code" /> : <span>Choose QR image</span>}
          </label>
          <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" className={styles.visuallyHidden} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <label htmlFor={inputId + '-upi'} className={styles.fieldLabel}>UPI ID (optional)</label>
          <input id={inputId + '-upi'} className={styles.textInput} value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@okaxis" autoComplete="off" />
          {error && <p className={styles.err}>{error}</p>}
          <div className={styles.prizeActions}>
            <button type="submit" className={styles.playBtn} disabled={busy}>{busy ? 'Uploading…' : 'Send QR code'}</button>
            {c && <button type="button" className={styles.ghostBtn} onClick={() => { setEditing(false); setFile(null); setError(''); }}>Cancel</button>}
          </div>
          <p className={styles.prizeNote}>Only Khabar Darjeeling&apos;s admin can see your QR code. It is used only to send this prize.</p>
        </form>
      )}
    </div>
  );
}
