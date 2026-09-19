'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getWorkerAuthToken } from '@/lib/appwrite';

const ENDPOINT = 'https://api.khabardarjeeling.in';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const ADMIN_EMAIL = 'nowanad@gmail.com';

interface Donation {
  id: string;
  name: string;
  email: string | null;
  amount: number | null;
  message: string | null;
  timestamp: string;
}

function fmtDate(s: string): string {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return s;
  }
}

export default function RaunakDonationsAdminPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [donations, setDonations] = useState<Donation[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(ENDPOINT + '/auth/me', { credentials: 'include' });
        if (!res.ok) { router.push('/auth'); return; }
        const user = await res.json();
        const labels = user.labels || [];
        const admin = user.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
        setIsAdmin(admin);
        setChecking(false);
        if (admin) await loadData();
      } catch {
        router.push('/auth');
      }
    }

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const jwt = await getWorkerAuthToken();
        if (!jwt) throw new Error('Could not verify admin session.');
        const res = await fetch(`${WORKER_URL}/donations`, { headers: { Authorization: 'Bearer ' + jwt } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load.');
        setDonations(data.documents || []);
        setTotalAmount(data.totalAmount || 0);
      } catch (e: any) {
        setError(e.message || 'Failed to load.');
      }
      setLoading(false);
    }

    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#a3a3a3', fontSize: '14px' }}>Checking access…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <p style={{ color: '#f87171', fontWeight: 700 }}>Access denied. Admin only.</p>
        <Link href="/" style={{ color: '#a3a3a3', fontSize: '13px', textDecoration: 'underline' }}>Back to Home</Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>
        <Link href="/admin" style={{ fontSize: '12px', color: '#737373', textDecoration: 'none' }}>← Back to Admin</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '4px 0 8px' }}>Raunak Fundraiser — Messages of Support</h1>
        <p style={{ fontSize: '13px', color: '#737373', marginBottom: '24px', maxWidth: '600px' }}>
          Self-reported entries from the <a href="/raunak-fundraiser" style={{ color: '#f5c518' }}>fundraiser page</a>'s form — not
          verified payments. Real donations happen directly via UPI to the family; this is only a log of who said they gave and their message.
        </p>

        {loading && <p style={{ color: '#a3a3a3', fontSize: '14px' }}>Loading…</p>}
        {error && <p style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>{error}</p>}

        {!loading && !error && (
          <>
            <div style={{ display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div style={{ background: '#171717', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', fontWeight: 700 }}>Entries</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>{donations.length}</div>
              </div>
              <div style={{ background: '#171717', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '16px 20px' }}>
                <div style={{ fontSize: '11px', color: '#737373', textTransform: 'uppercase', fontWeight: 700 }}>Self-reported total</div>
                <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>₹{totalAmount.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {donations.length === 0 ? (
              <p style={{ color: '#737373', fontSize: '14px' }}>No entries yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {donations.map((d) => (
                  <div key={d.id} style={{ background: '#171717', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{d.name}</div>
                      <div style={{ fontSize: '12px', color: '#737373' }}>{fmtDate(d.timestamp)}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#a3a3a3', marginTop: '2px' }}>
                      {d.email || '(no email)'} {d.amount != null && <span style={{ color: '#f5c518', fontWeight: 700 }}> · ₹{d.amount.toLocaleString('en-IN')}</span>}
                    </div>
                    {d.message && <div style={{ fontSize: '13px', color: '#d4d4d4', marginTop: '8px', lineHeight: 1.5 }}>{d.message}</div>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
