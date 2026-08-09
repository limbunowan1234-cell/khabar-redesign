'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const BUCKET = 'article-image';
const H = { 'X-Appwrite-Project': PROJECT };

function getImageUrl(fileId: string): string {
  return ENDPOINT + '/storage/buckets/' + BUCKET + '/files/' + fileId + '/view?project=' + PROJECT;
}

export default function HillsInFrameWidget() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const q1 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
        const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [4] }));
        const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/photography/documents?queries[]=' + q1 + '&queries[]=' + q2, { headers: H });
        if (res.ok) {
          const data = await res.json();
          setPhotos(data.documents || []);
        }
      } catch (err) {
        console.error('Failed to load hills in frame photos:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!loading && photos.length === 0) return null;

  return (
    <div style={{ marginBottom: '32px', background: 'var(--color-surface)', borderRadius: '8px', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '18px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          Hills in Frame
        </h2>
        <Link href="/hills-in-frame" style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
          View all &rarr;
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
        {photos.map((photo: any) => (
          <Link key={photo.$id} href={'/hills-in-frame/' + photo.$id} style={{ textDecoration: 'none' }}>
            <div style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', aspectRatio: '1', background: 'linear-gradient(135deg, #94a3b8, #475569)' }}>
              {photo.imageFileId && (
                <img
                  src={getImageUrl(photo.imageFileId)}
                  alt={photo.title}
                  loading="lazy"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)', padding: '20px 10px 8px' }}>
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 700, color: 'white', margin: 0, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const }}>{photo.title}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}