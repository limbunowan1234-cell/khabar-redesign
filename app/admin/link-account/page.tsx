'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getWorkerAuthToken } from '@/lib/appwrite';

const ENDPOINT = 'https://api.khabardarjeeling.in';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const ADMIN_EMAIL = 'nowanad@gmail.com';

interface Candidate {
  userId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  homeDistrict: string | null;
  joinedAt: string | null;
  alreadyLinked: boolean;
}

function fmtDate(s: string | null): string {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return s;
  }
}

const cardStyle: React.CSSProperties = {
  borderRadius: '12px',
  backgroundColor: '#171717',
  border: '1px solid #2a2a2a',
  padding: '18px',
};

export default function LinkAccountPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);

  const [emailByUser, setEmailByUser] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState<string | null>(null);
  const [resultByUser, setResultByUser] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(ENDPOINT + '/auth/me', { credentials: 'include' });
        if (!res.ok) {
          router.push('/auth');
          return;
        }
        const user = await res.json();
        const labels = user.labels || [];
        const admin = user.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
        setIsAdmin(admin);
        setChecking(false);
      } catch {
        router.push('/auth');
      }
    }
    checkAuth();
  }, [router]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearched(true);
    try {
      const jwt = await getWorkerAuthToken();
      if (!jwt) throw new Error('Could not verify admin session.');
      const res = await fetch(`${WORKER_URL}/auth/admin/search-accounts?q=${encodeURIComponent(query.trim())}`, {
        headers: { Authorization: 'Bearer ' + jwt },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed.');
      setCandidates(data.candidates || []);
    } catch (e: any) {
      setSearchError(e.message || 'Search failed.');
      setCandidates([]);
    }
    setSearching(false);
  }

  async function handleLink(userId: string) {
    const email = (emailByUser[userId] || '').trim();
    if (!email) return;
    setLinking(userId);
    setResultByUser((prev) => ({ ...prev, [userId]: undefined as any }));
    try {
      const jwt = await getWorkerAuthToken();
      if (!jwt) throw new Error('Could not verify admin session.');
      const res = await fetch(`${WORKER_URL}/auth/admin/link-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jwt },
        body: JSON.stringify({ userId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Link failed.');
      setResultByUser((prev) => ({ ...prev, [userId]: { ok: true, message: `Linked. Reset email sent to ${email}.` } }));
      setCandidates((prev) => prev.map((c) => (c.userId === userId ? { ...c, alreadyLinked: true } : c)));
    } catch (e: any) {
      setResultByUser((prev) => ({ ...prev, [userId]: { ok: false, message: e.message || 'Link failed.' } }));
    }
    setLinking(null);
  }

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
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>
        <Link href="/admin" style={{ fontSize: '12px', color: '#737373', textDecoration: 'none' }}>← Back to Admin</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '4px 0 0' }}>Link Account by Email</h1>
        <p style={{ fontSize: '13px', color: '#737373', marginTop: '6px', marginBottom: '24px', maxWidth: '600px' }}>
          For people who commented or liked before the auth migration but have no email on file, so
          the normal reset-link recovery can&apos;t reach them. Search by the name on their profile,
          confirm out-of-band that whoever is asking is actually them (there&apos;s no automated proof
          of identity for these accounts), then link the email they give you. This preserves their
          original account — same id, same comments, likes, and profile — and sends them a normal
          password-reset email to set their own password.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by display name…"
            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #2a2a2a', backgroundColor: '#171717', color: 'white', fontSize: '14px' }}
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#f5c518', color: '#0a0a0a', fontWeight: 700, fontSize: '14px', cursor: searching ? 'default' : 'pointer', opacity: searching ? 0.6 : 1 }}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchError && <p style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>{searchError}</p>}
        {searched && !searching && !searchError && candidates.length === 0 && (
          <p style={{ color: '#737373', fontSize: '14px' }}>No profiles match that name.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {candidates.map((c) => {
            const result = resultByUser[c.userId];
            return (
              <div key={c.userId} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{c.displayName || '(no name)'}</div>
                    {c.bio && <div style={{ fontSize: '13px', color: '#a3a3a3', marginTop: '2px' }}>{c.bio}</div>}
                    <div style={{ fontSize: '11px', color: '#525252', marginTop: '6px' }}>
                      {c.homeDistrict && <>{c.homeDistrict} · </>}
                      Joined {fmtDate(c.joinedAt)} · id {c.userId}
                    </div>
                  </div>
                  {c.alreadyLinked && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#4ade80', backgroundColor: '#14532d', padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                      Already linked
                    </span>
                  )}
                </div>

                {!c.alreadyLinked && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <input
                      type="email"
                      placeholder="their-email@example.com"
                      value={emailByUser[c.userId] || ''}
                      onChange={(e) => setEmailByUser((prev) => ({ ...prev, [c.userId]: e.target.value }))}
                      style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #2a2a2a', backgroundColor: '#0f0f0f', color: 'white', fontSize: '13px' }}
                    />
                    <button
                      onClick={() => handleLink(c.userId)}
                      disabled={linking === c.userId || !(emailByUser[c.userId] || '').trim()}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#f5c518', color: '#0a0a0a', fontWeight: 700, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {linking === c.userId ? 'Linking…' : 'Link & Send Reset Email'}
                    </button>
                  </div>
                )}

                {result && (
                  <p style={{ fontSize: '13px', marginTop: '10px', color: result.ok ? '#4ade80' : '#f87171' }}>{result.message}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
