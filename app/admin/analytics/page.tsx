'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': PROJECT };
const ADMIN_EMAIL = 'nowanad@gmail.com';

interface AnalyticsData {
  mau: number;
  dau: number;
  avgSessionMinutes: number;
  totalArticles: number;
  articlesThisMonth: number;
  totalContributors: number;
  activeContributorsThisMonth: number;
  geoSplit: { label: string; note: string }[];
  topArticles: { articleId: string; title: string; author: string; viewsThisMonth: number; lifetimeViews: number }[];
  trend: { date: string; uniqueUsers: number }[];
  trackedEventCount: number;
  generatedAt: string;
}

const cardStyle: React.CSSProperties = {
  borderRadius: '12px',
  backgroundColor: '#171717',
  border: '1px solid #2a2a2a',
  padding: '20px',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: '#a3a3a3',
  marginBottom: '16px',
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#a3a3a3' }}>{label}</div>
      <div style={{ marginTop: '8px', fontSize: '28px', fontWeight: 800, color: 'white' }}>{value}</div>
      {sub && <div style={{ marginTop: '4px', fontSize: '12px', color: '#737373' }}>{sub}</div>}
    </div>
  );
}

function fmtDateLabel(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return dateStr;
  }
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        if (!res.ok) {
          router.push('/auth');
          return;
        }
        const user = await res.json();
        const labels = user.labels || [];
        const admin = user.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
        if (!admin) {
          setChecking(false);
          return;
        }
        setIsAdmin(true);
        setChecking(false);
        await loadData();
      } catch {
        router.push('/auth');
      }
    }

    async function loadData() {
      setLoadingData(true);
      setLoadError('');
      try {
        const jwtRes = await fetch(ENDPOINT + '/account/jwt', { method: 'POST', headers: H, credentials: 'include' });
        if (!jwtRes.ok) throw new Error('Could not verify admin session.');
        const { jwt } = await jwtRes.json();
        const res = await fetch('/api/admin/analytics', { headers: { 'x-admin-jwt': jwt } });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load analytics.');
        setData(json);
      } catch (e: any) {
        setLoadError(e.message || 'Failed to load analytics.');
      }
      setLoadingData(false);
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
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '28px' }}>
          <div>
            <Link href="/admin" style={{ fontSize: '12px', color: '#737373', textDecoration: 'none' }}>← Back to Admin</Link>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '4px 0 0' }}>Engagement Analytics</h1>
            <p style={{ fontSize: '13px', color: '#737373', marginTop: '6px', maxWidth: '560px' }}>
              MAU/DAU and session time are measured from tracked page views only — since tracking just went live, these will fill in over the coming days rather than show history.
            </p>
          </div>
          {data && <div style={{ fontSize: '12px', color: '#737373' }}>Updated {new Date(data.generatedAt).toLocaleString()}</div>}
        </div>

        {loadingData && <p style={{ color: '#a3a3a3', fontSize: '14px' }}>Loading analytics…</p>}
        {loadError && <p style={{ color: '#f87171', fontSize: '14px', marginBottom: '16px' }}>{loadError}</p>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
              <StatCard label="MAU (30d)" value={data.mau} sub="unique visitors" />
              <StatCard label="DAU (today)" value={data.dau} sub="unique visitors" />
              <StatCard label="Avg Session" value={data.avgSessionMinutes + ' min'} sub={data.trackedEventCount + ' events tracked'} />
              <StatCard label="Total Articles" value={data.totalArticles} sub="published" />
              <StatCard label="Articles This Month" value={data.articlesThisMonth} sub="last 30 days" />
              <StatCard label="Total Contributors" value={data.totalContributors} sub="unique authors" />
              <StatCard label="Active Contributors" value={data.activeContributorsThisMonth} sub="published last 30 days" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
              <div style={cardStyle}>
                <div style={sectionLabelStyle}>7-Day Traffic Trend</div>
                <div style={{ height: '260px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                      <XAxis dataKey="date" tickFormatter={fmtDateLabel} stroke="#737373" fontSize={12} />
                      <YAxis stroke="#737373" fontSize={12} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: '#171717', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                        labelFormatter={(label) => fmtDateLabel(String(label))}
                        formatter={(v) => [String(v), 'Unique users']}
                      />
                      <Line type="monotone" dataKey="uniqueUsers" stroke="#f5c518" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={sectionLabelStyle}>Geo Split</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.geoSplit.map((g) => (
                    <div key={g.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '8px', backgroundColor: '#212121', padding: '10px 14px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{g.label}</span>
                      <span style={{ fontSize: '11px', color: '#737373' }}>{g.note}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: '#525252', marginTop: '12px' }}>IP-based geo tracking isn't built yet — placeholder categories only.</p>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={sectionLabelStyle}>Top 5 Articles This Month</div>
              {data.topArticles.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#737373' }}>No tracked views yet this month.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#737373', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #2a2a2a' }}>
                        <th style={{ padding: '8px 12px 8px 0', fontWeight: 600 }}>#</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Article</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Author</th>
                        <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Views (30d)</th>
                        <th style={{ padding: '8px 0 8px 12px', fontWeight: 600, textAlign: 'right' }}>Lifetime Views</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topArticles.map((a, i) => (
                        <tr key={a.articleId} style={{ borderBottom: '1px solid #1f1f1f' }}>
                          <td style={{ padding: '12px 12px 12px 0', color: '#737373' }}>{i + 1}</td>
                          <td style={{ padding: '12px' }}>
                            <a href={'/article/' + a.articleId} target="_blank" rel="noopener noreferrer" style={{ color: '#f5f5f5', textDecoration: 'none' }}>{a.title}</a>
                          </td>
                          <td style={{ padding: '12px', color: '#a3a3a3' }}>{a.author}</td>
                          <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{a.viewsThisMonth}</td>
                          <td style={{ padding: '12px 0 12px 12px', textAlign: 'right', color: '#737373' }}>{a.lifetimeViews.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
