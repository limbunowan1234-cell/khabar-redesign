import type { Metadata } from 'next';
import Link from 'next/link';
import { ROAD_STATUSES, statusMeta, formatDay, daysSince, isStale, type RoadEntry } from '@/lib/roadStatus';

const SITE = 'https://khabardarjeeling.in';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

async function fetchRoads(): Promise<{ roads: RoadEntry[]; updatedAt: string | null }> {
  try {
    // A minute of caching keeps this cheap under a rush of readers during a
    // landslide, while a changed entry still shows up almost immediately.
    const res = await fetch(WORKER_URL + '/roads', { next: { revalidate: 60 } });
    if (!res.ok) return { roads: [], updatedAt: null };
    const data = await res.json();
    return { roads: data.documents || [], updatedAt: data.updatedAt || null };
  } catch {
    return { roads: [], updatedAt: null };
  }
}

export const metadata: Metadata = {
  title: 'Hills Road Status: Closures and Diversions',
  description: 'Which roads are closed, restricted or diverted between the hills and the plains: NH-10 Sevoke to Rangpo, the Dudhia bridge and more, with alternative routes.',
  alternates: { canonical: SITE + '/road-status' },
  openGraph: {
    title: 'Hills Road Status: Closures and Diversions - Khabar Darjeeling',
    description: 'Closed, restricted and diverted roads in the hills, with alternative routes.',
    url: SITE + '/road-status',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default async function RoadStatusPage() {
  const { roads, updatedAt } = await fetchRoads();
  const now = Date.now();
  const counts = ROAD_STATUSES.map((s) => ({ ...s, n: roads.filter((r) => r.status === s.key).length })).filter((s) => s.n > 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#c41e3a', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', textDecoration: 'none', fontSize: '18px', fontWeight: 800 }}>Khabar Darjeeling</Link>
        <Link href="/" style={{ background: 'white', color: '#c41e3a', padding: '8px 18px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Home</Link>
      </div>

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '30px', fontWeight: 800, color: '#111827' }}>Hills Road Status</h1>
        <p style={{ margin: '0 0 6px', fontSize: '15px', color: '#4b5563', maxWidth: '62ch' }}>
          Closures, restrictions, diversions and road works on the routes linking the hills and the plains.
        </p>
        {updatedAt && <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#6b7280' }}>Last updated {formatDay(updatedAt)}</p>}

        {counts.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {counts.map((s) => (
              <span key={s.key} style={{ background: s.bg, color: s.color, padding: '5px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 700 }}>
                {s.n} {s.label.toLowerCase()}
              </span>
            ))}
          </div>
        )}

        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#78350f', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', lineHeight: 1.5, marginBottom: '24px' }}>
          Road conditions can change within hours, especially in the monsoon. Before you set out, confirm with the local traffic police or the road authority.
        </div>

        {roads.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '48px 20px', textAlign: 'center', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            No road alerts right now.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {roads.map((r) => {
              const s = statusMeta(r.status);
              const stale = isStale(r, now);
              const external = !!r.linkUrl && /^https?:\/\//i.test(r.linkUrl);
              return (
                <section key={r.$id} id={'road-' + r.$id} style={{ background: 'white', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '5px solid ' + s.color }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>{r.name}</h2>
                  </div>

                  <p style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 700, color: '#1f2937', lineHeight: 1.4 }}>{r.summary}</p>

                  {r.diversion && (
                    <div style={{ background: '#f3f4f6', borderRadius: '8px', padding: '10px 14px', margin: '0 0 10px', fontSize: '14px', lineHeight: 1.5, color: '#1f2937' }}>
                      <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '2px' }}>Diversion</strong>
                      {r.diversion}
                    </div>
                  )}

                  {r.nextDate && (
                    <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#374151' }}><strong>Next:</strong> {r.nextDate}</p>
                  )}

                  {r.details && (
                    <details style={{ margin: '0 0 10px' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: '#c41e3a' }}>More details</summary>
                      <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: 1.6, color: '#4b5563' }}>{r.details}</p>
                    </details>
                  )}

                  {stale && (
                    <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#b45309', fontWeight: 600 }}>
                      Last confirmed {daysSince(r.updatedAt, now)} days ago. Check the current situation before you travel.
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#6b7280' }}>
                    <span>Updated {formatDay(r.updatedAt)}{r.source ? ' · ' + r.source : ''}</span>
                    {r.linkUrl && (external
                      ? <a href={r.linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#c41e3a', fontWeight: 700, textDecoration: 'none' }}>Full details &rarr;</a>
                      : <Link href={r.linkUrl} style={{ color: '#c41e3a', fontWeight: 700, textDecoration: 'none' }}>Full details &rarr;</Link>)}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <p style={{ margin: '28px 0 0', fontSize: '13px', color: '#6b7280' }}>
          Seen a closure, a diversion or a reopened road that isn&apos;t here? <Link href="/contact" style={{ color: '#c41e3a', fontWeight: 700 }}>Tell the newsroom</Link>.
        </p>
      </main>
    </div>
  );
}
