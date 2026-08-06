import type { Metadata } from 'next';
import Link from 'next/link';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.in';
const BUCKET = 'article-image';

function getImageUrl(fileId: string): string {
  return ENDPOINT + '/storage/buckets/' + BUCKET + '/files/' + fileId + '/view?project=' + PROJECT;
}

async function fetchPhotos(): Promise<any[]> {
  try {
    const q1 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [50] }));
    const res = await fetch(
      ENDPOINT + '/databases/' + DB + '/collections/photography/documents?queries[]=' + q1 + '&queries[]=' + q2,
      { headers: { 'X-Appwrite-Project': PROJECT }, next: { revalidate: 300 } }
    );
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
          <div style={{ background: 'white', borderRadius: '12px', padding: '60px', textAlign: 'center', color: '#9ca3af' }}>
            No photos yet - check back soon.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
            {photos.map((photo: any) => (
              <Link key={photo.$id} href={'/hills-in-frame/' + photo.$id} style={{ textDecoration: 'none' }}>
                <div style={{ borderRadius: '12px', overflow: 'hidden', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ height: '180px', background: '#e5e7eb' }}>
                    {photo.imageFileId && (
                      <img src={getImageUrl(photo.imageFileId)} alt={photo.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ padding: '14px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{photo.title}</div>
                    {photo.location && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{photo.location}</div>}
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>By {photo.submitterName}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
