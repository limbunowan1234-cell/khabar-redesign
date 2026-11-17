'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getWorkerAuthToken } from '@/lib/appwrite';

const endpoint = 'https://api.khabardarjeeling.in';
const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const MODE_LABEL: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

interface Claim { id: string; status: 'submitted' | 'paid'; upiId: string | null; submittedAt: string; paidAt: string | null }
interface Winner { mode: string; amount: number; gameName: string | null; phone: string | null; score: number | null; claim: Claim | null }
interface Round { period: string; start: string; end: string; closed: boolean; winners: Winner[] }

function day(date: string | null): string {
  if (!date) return '';
  const d = new Date(date.length === 10 ? date + 'T00:00:00Z' : date.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? date : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: date.length === 10 ? 'UTC' : 'Asia/Kolkata' });
}

// Simon Speed prize payouts: every round's #1 in each mode, the UPI QR code
// they uploaded, and a button to mark the prize paid.
export default function AdminPrizesPage() {
  const [user, setUser] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [qr, setQr] = useState<Record<string, string>>({});

  async function loadRounds() {
    const token = await getWorkerAuthToken();
    const res = await fetch(WORKER_URL + '/prizes', { headers: { Authorization: 'Bearer ' + token } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not load prizes');
    setRounds(data.rounds || []);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(endpoint + '/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const labels: string[] = data.labels || [];
          if (data.email?.toLowerCase() !== ADMIN_EMAIL && !labels.includes('admin')) {
            setError('Access denied. Admin only.');
          } else {
            setUser(data);
            await loadRounds();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load prizes');
      }
      setLoading(false);
    })();
  }, []);

  // QR images need the admin token, so they're fetched and shown as blobs.
  async function showQr(id: string) {
    try {
      const token = await getWorkerAuthToken();
      const res = await fetch(WORKER_URL + '/prizes/' + id + '/qr', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) throw new Error('Could not load the QR code');
      const url = URL.createObjectURL(await res.blob());
      setQr((q) => ({ ...q, [id]: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the QR code');
    }
  }

  async function setStatus(id: string, status: 'paid' | 'submitted') {
    if (status === 'paid' && !window.confirm('Mark this prize as paid? The winner will see it as paid.')) return;
    try {
      const token = await getWorkerAuthToken();
      const res = await fetch(WORKER_URL + '/prizes/' + id, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Update failed');
      await loadRounds();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', fontSize: '18px' }}>Loading...</div>;

  if (!user) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ fontSize: '18px', marginBottom: '20px', color: '#c41e3a' }}>{error || 'Please login to access this page.'}</p>
      <Link href="/auth"><button style={{ backgroundColor: '#0F4C5C', color: 'white', padding: '12px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Login</button></Link>
    </div>
  );

  const pill = (text: string, bg: string, fg: string) => (
    <span style={{ background: bg, color: fg, padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{text}</span>
  );
  const btn = (bg: string, fg: string) => ({ padding: '8px 14px', background: bg, color: fg, border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }) as const;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F4C5C, #0a3540)', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Link href="/admin" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>Back to Admin</Link>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Simon Speed prizes</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>
            Each round&apos;s #1 in every mode. Winners upload their UPI QR code on the <Link href="/play/simon-speed" style={{ color: '#f5c518' }}>game page</Link>; pay them, then mark the prize paid.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '30px 20px', display: 'grid', gap: '24px' }}>
        {error && <div style={{ background: '#fee2e2', color: '#c41e3a', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' }}>{error}</div>}
        {rounds.length === 0 && <p>No rounds yet.</p>}
        {rounds.map((r) => (
          <section key={r.period} style={{ background: 'white', borderRadius: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>Round {day(r.start)} – {day(r.end)}</h2>
              {r.closed ? pill('Finished', '#e0f2fe', '#075985') : pill('In progress · leaders can still change', '#fef3c7', '#92400e')}
            </div>
            <div style={{ display: 'grid', gap: '12px' }}>
              {r.winners.map((w) => (
                <div key={w.mode} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'start', padding: '14px', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '15px' }}>{MODE_LABEL[w.mode]} · ₹{w.amount}</strong>
                      {!w.gameName ? pill('No winner', '#f3f4f6', '#6b7280')
                        : w.claim?.status === 'paid' ? pill('Paid', '#dcfce7', '#166534')
                        : w.claim ? pill('QR received', '#ede9fe', '#5b21b6')
                        : r.closed ? pill('Waiting for QR', '#fee2e2', '#991b1b') : null}
                    </div>
                    {w.gameName && (
                      <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>
                        <strong>{w.gameName}</strong> · {w.score} points<br />
                        Phone: <a href={'tel:' + w.phone} style={{ color: '#1565c0' }}>{w.phone}</a>
                        {w.phone && <> · <a href={'https://wa.me/' + w.phone.replace('+', '')} target="_blank" rel="noopener noreferrer" style={{ color: '#15803d' }}>WhatsApp</a></>}
                        {w.claim?.upiId && <><br />UPI ID: <strong style={{ userSelect: 'all' }}>{w.claim.upiId}</strong></>}
                        {w.claim && <><br /><span style={{ color: '#6b7280', fontSize: '13px' }}>QR sent {day(w.claim.submittedAt)}{w.claim.paidAt ? ' · paid ' + day(w.claim.paidAt) : ''}</span></>}
                      </p>
                    )}
                    {w.claim && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                        {!qr[w.claim.id] && <button type="button" onClick={() => showQr(w.claim!.id)} style={btn('#e3f2fd', '#1565c0')}>Show QR code</button>}
                        {w.claim.status !== 'paid'
                          ? <button type="button" onClick={() => setStatus(w.claim!.id, 'paid')} style={btn('#16a34a', 'white')}>Mark paid</button>
                          : <button type="button" onClick={() => setStatus(w.claim!.id, 'submitted')} style={btn('#f3f4f6', '#374151')}>Undo paid</button>}
                      </div>
                    )}
                  </div>
                  {w.claim && qr[w.claim.id] && (
                    <img src={qr[w.claim.id]} alt={'UPI QR code from ' + w.gameName} style={{ width: '160px', maxWidth: '40vw', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white' }} />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
