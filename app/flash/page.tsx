import type { Metadata } from 'next';
import Link from 'next/link';

// Flash News: short, photo-first updates posted by readers and reporters
// (from the Android app 1.4.0 or the site). Stored as articles with
// kind = 'flash', so each one opens on the normal /article/[slug] page.

const SITE = 'https://khabardarjeeling.in';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

type Flash = {
  $id: string;
  slug: string | null;
  title: string;
  content: string | null;
  imageFileId: string | null;
  locationArea: string | null;
  locationDistrict: string | null;
  genre: string | null;
  isBreaking: boolean;
  publishedAt: string | null;
  $createdAt: string;
  authorName: string | null;
  submitterName: string | null;
  submitterId: string | null;
  byStaff?: boolean;
  likeCount?: number;
  commentCount?: number;
  relatedArticleId: string | null;
};

async function fetchFlash(): Promise<Flash[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?kind=flash&limit=60&stats=1', { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(/Z|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const metadata: Metadata = {
  title: 'Flash News: Quick Photo Updates from the Hills',
  description: 'Short photo updates from Darjeeling, Kalimpong, Kurseong, Mirik, Siliguri and Sikkim, posted as things happen.',
  alternates: { canonical: SITE + '/flash' },
  openGraph: {
    title: 'Flash News - Khabar Darjeeling',
    description: 'Quick photo updates from the hills, as they happen.',
    url: SITE + '/flash',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default async function FlashNewsPage() {
  const items = await fetchFlash();

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#c41e3a', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', textDecoration: 'none', fontSize: '18px', fontWeight: 800 }}>Khabar Darjeeling</Link>
        <Link href="/" style={{ background: 'white', color: '#c41e3a', padding: '8px 18px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Home</Link>
      </div>

      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '32px 20px 60px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '30px', fontWeight: 800, color: '#111827' }}>⚡ Flash News</h1>
        <p style={{ margin: '0 0 22px', fontSize: '15px', color: '#4b5563', maxWidth: '62ch' }}>
          Quick photo updates from across the hills, posted as things happen. Community posts come from readers; tap any update for
          the full post, comments and the related story.
        </p>

        {items.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '48px 20px', textAlign: 'center', color: '#6b7280', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            No Flash News yet. Post one from the Khabar Darjeeling app.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
            {items.map((f) => {
              const place = f.locationArea || f.locationDistrict;
              const by = f.authorName || f.submitterName || 'Khabar Darjeeling';
              return (
                <Link
                  key={f.$id}
                  href={'/article/' + (f.slug || f.$id)}
                  style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', textDecoration: 'none', color: 'inherit', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ position: 'relative', aspectRatio: '4 / 3', background: '#e5e7eb' }}>
                    {f.imageFileId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={WORKER_URL + '/cdn/articles/' + f.imageFileId} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                    <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
                      {f.isBreaking && <span style={{ background: '#c41e3a', color: 'white', fontSize: '11px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px' }}>BREAKING</span>}
                      <span style={{ background: 'rgba(255,255,255,0.92)', color: f.byStaff ? '#0f4c5c' : '#b3122f', fontSize: '11px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px' }}>
                        {f.byStaff ? 'Khabar Darjeeling' : 'Community'}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, lineHeight: 1.3, color: '#111827' }}>{f.title}</h2>
                    {f.content && <p style={{ margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: 1.5 }}>{f.content.length > 160 ? f.content.slice(0, 157) + '…' : f.content}</p>}
                    <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '12px', color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                      {place && <span>📍 {place}</span>}
                      <span>{timeAgo(f.publishedAt || f.$createdAt)}</span>
                      <span>By {by}</span>
                      {typeof f.likeCount === 'number' && <span>♥ {f.likeCount}</span>}
                      {typeof f.commentCount === 'number' && <span>💬 {f.commentCount}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
