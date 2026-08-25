import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

const SITE = 'https://khabardarjeeling.in';
// Week 43 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function getImageUrl(fileId: string): string {
  return WORKER_URL + '/cdn/articles/' + fileId;
}

async function fetchPhotos(): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/photography?limit=50', { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Hills in Frame - Photography | Khabar Darjeeling',
  description: 'Beautiful raw photography from Darjeeling and the Gorkha hills, curated by our photographers.',
  alternates: { canonical: SITE + '/hills-in-frame' },
  openGraph: {
    title: 'Hills in Frame - Khabar Darjeeling',
    description: 'Beautiful raw photography from Darjeeling and the Gorkha hills.',
    url: SITE + '/hills-in-frame',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default async function HillsInFramePage() {
  const photos = await fetchPhotos();

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#c41e3a', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', textDecoration: 'none', fontSize: '18px', fontWeight: 800 }}>Khabar Darjeeling</Link>
        <Link href="/" style={{ background: 'white', color: '#c41e3a', padding: '8px 18px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Home</Link>
      </div>

      <div style={{
        position: 'relative',
        height: '240px',
        backgroundImage: 'linear-gradient(105deg, rgba(20,20,30,0.75) 0%, rgba(20,20,30,0.35) 50%, rgba(20,20,30,0.1) 100%), url(/assets/hills-in-frame-hero.jpeg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '0 24px 20px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: 'white', fontFamily: 'Georgia, serif', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>Hills in Frame</h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>Photography from Darjeeling and beyond</p>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        {photos.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', padding: '70px 20px', textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📷</div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#6b7280' }}>No photos yet</p>
            <p style={{ margin: '4px 0 0', fontSize: '13px' }}>Check back soon for fresh shots from the hills.</p>
          </div>
        ) : (
          <>
          <style>{'@keyframes hifFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .hif-card { transition: transform 0.25s ease, box-shadow 0.25s ease; animation: hifFadeIn 0.4s ease both; } .hif-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.16) !important; } .hif-card img { transition: transform 0.5s ease; } .hif-card:hover img { transform: scale(1.06); }'}</style>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '26px' }}>
            {photos.map((photo: any, i: number) => (
              <Link key={photo.$id} href={'/hills-in-frame/' + photo.$id} style={{ textDecoration: 'none' }}>
                <div className='hif-card' style={{ borderRadius: '4px', overflow: 'hidden', background: 'white', padding: '10px 10px 0', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', border: '1px solid #eee', animationDelay: Math.min(i * 0.05, 0.5) + 's' }}>
                  <div style={{ position: 'relative', height: '200px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                    {photo.imageFileId && (
                      <Image src={getImageUrl(photo.imageFileId)} alt={photo.title} fill sizes='(max-width: 768px) 50vw, 300px' style={{ objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ padding: '14px 6px 16px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, fontFamily: 'Georgia, serif' }}>{photo.title}</div>
                    {photo.location && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '5px' }}>&#128205; {photo.location}</div>}
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>By {photo.submitterName}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
