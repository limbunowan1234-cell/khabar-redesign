import type { Metadata } from 'next';
import Link from 'next/link';
import HillsInFrameSwipeClient from '@/components/HillsInFrameSwipeClient';

const SITE = 'https://khabardarjeeling.in';
// Week 43 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function getImageUrl(fileId: string): string {
  return WORKER_URL + '/cdn/articles/' + fileId;
}

async function fetchAllPhotos(): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/photography?limit=100', { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const photos = await fetchAllPhotos();
  const photo = photos.find((p: any) => p.$id === id);
  if (!photo) return { title: 'Photo | Hills in Frame | Khabar Darjeeling' };

  const title = photo.title + ' | Hills in Frame';
  const description = photo.caption ? photo.caption.slice(0, 150) : 'Photography from Darjeeling and the Gorkha hills.';
  const url = SITE + '/hills-in-frame/' + id;
  const image = photo.imageFileId ? getImageUrl(photo.imageFileId) : SITE + '/assets/logo.png';
  const looksLowQuality = (photo.caption || '').trim().length < 100;


  return {
    title,
    description,
    robots: looksLowQuality ? { index: false, follow: true } : { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Khabar Darjeeling',
      type: 'article',
      images: [{ url: image, width: 1200, height: 630, alt: photo.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function HillsInFrameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photos = await fetchAllPhotos();
  const startIndex = photos.findIndex((p: any) => p.$id === id);

  if (startIndex === -1 || photos.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#333' }}>Photo not found</p>
        <Link href="/hills-in-frame" style={{ color: '#c41e3a', fontWeight: 700, textDecoration: 'none' }}>Back to Hills in Frame</Link>
      </div>
    );
  }

  return <HillsInFrameSwipeClient photos={photos} startIndex={startIndex} />;
}
