'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWorkerAuthToken, getCurrentUser } from '@/lib/appwrite';
import { AD_CAMPAIGN_ID, AD_PLACEMENTS } from '@/lib/adConfig';

// Calls cloudflare/src/routes/ads.ts's GET /ads/analytics directly with
// the admin's own JWT -- that route does real admin verification itself
// (verifyUser + isAdmin), so there's no Next.js proxy needed here, same
// pattern as WinnersGallery.tsx's winner-address submission.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

const PLACEMENT_LABELS: Record<string, string> = {
  'homepage-hero-banner': 'Homepage Hero Banner',
  'homepage-sidebar': 'Homepage Sidebar',
};

export default function AdsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [campaignActive, setCampaignActive] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) { setError('Please log in.'); setLoading(false); return; }

        const jwt = await getWorkerAuthToken();
        if (!jwt) { setError('Could not verify your session.'); setLoading(false); return; }

        const [analyticsRes, campaignRes] = await Promise.all([
          fetch(`${WORKER_URL}/ads/analytics?campaignId=${encodeURIComponent(AD_CAMPAIGN_ID)}`, {
            headers: { Authorization: 'Bearer ' + jwt },
          }),
          fetch(`${WORKER_URL}/ads/campaign/${encodeURIComponent(AD_CAMPAIGN_ID)}`),
        ]);

        if (analyticsRes.status === 403) { setError('Admin access required.'); setLoading(false); return; }
        if (!analyticsRes.ok) { setError('Failed to load analytics.'); setLoading(false); return; }

        setData(await analyticsRes.json());
        if (campaignRes.ok) setCampaignActive((await campaignRes.json()).active);
      } catch {
        setError('Failed to load.');
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '80px' }}>Loading...</div>;
  if (error) return (
    <div style={{ textAlign: 'center', padding: '80px' }}>
      <p style={{ color: '#c41e3a', fontWeight: 700 }}>{error}</p>
      <Link href="/" style={{ color: '#c41e3a' }}>← Back to Home</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '30px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#b91c1c', margin: 0 }}>Ad Campaigns</h1>
          <Link href="/admin" style={{ color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>← Admin Panel</Link>
        </div>

        <div style={{
          background: campaignActive ? '#f0fdf4' : '#fff8e1',
          border: '1px solid ' + (campaignActive ? '#bbf7d0' : '#fde68a'),
          borderRadius: '8px', padding: '16px 20px', marginBottom: '24px',
        }}>
          <p style={{ margin: 0, fontWeight: 700, color: campaignActive ? '#15803d' : '#92400e' }}>
            {campaignActive ? '🟢 Campaign is LIVE' : '🟡 Campaign is OFF — not showing to any reader'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6b7280' }}>
            Russia Warehouse Jobs — Subha Enterprise Consultant LLP. Toggle via the <code>active</code> column
            on the <code>ad_campaigns</code> row in D1 (deliberately no on/off button here yet — this stays a
            manual, deliberate step until the advertiser's recruitment license is verified).
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px' }}>Last 30 Days</h2>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div><div style={{ fontSize: '28px', fontWeight: 800, color: '#111827' }}>{data?.totals?.impressions ?? 0}</div><div style={{ fontSize: '12px', color: '#6b7280' }}>Impressions</div></div>
            <div><div style={{ fontSize: '28px', fontWeight: 800, color: '#111827' }}>{data?.totals?.clicks ?? 0}</div><div style={{ fontSize: '12px', color: '#6b7280' }}>Clicks</div></div>
            <div><div style={{ fontSize: '28px', fontWeight: 800, color: '#111827' }}>{data?.totals?.ctr ?? 0}%</div><div style={{ fontSize: '12px', color: '#6b7280' }}>CTR</div></div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px' }}>By Placement</h2>
          {Object.keys(AD_PLACEMENTS).length === 0 ? (
            <p style={{ color: '#9ca3af' }}>No placements configured.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.values(AD_PLACEMENTS).map((p) => {
                const stats = data?.byPlacement?.[p.id] || { impressions: 0, clicks: 0 };
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#f9fafb', borderRadius: '6px' }}>
                    <span style={{ fontWeight: 600 }}>{PLACEMENT_LABELS[p.id] || p.id}</span>
                    <span style={{ color: '#6b7280', fontSize: '13px' }}>{stats.impressions} impressions · {stats.clicks} clicks</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
