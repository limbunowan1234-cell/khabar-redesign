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

export default function HillsInFrameWidget({ isDarkMode }: { isDarkMode?: boolean }) {
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
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '4px', height: '18px', backgroundColor: '#374151', borderRadius: '2px', display: 'inline-block' }} />
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: isDarkMode ? '#fff' : '#1f2937', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
            Hills in Frame
          </h3>
        </div>
        <Link href="/hills-in-frame" style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#888', textDecoration: 'none' }}>
          View all &rarr;
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
        {photos.map((photo: any) => (
          <Link key={photo.$id} href={'/hills-in-frame/' + photo.$id} style={{ textDecoration: 'none' }}>
            <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '1', background: '#e5e7eb' }}>
              {photo.imageFileId && (
                <img
                  src={getImageUrl(photo.imageFileId)}
                  alt={photo.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', padding: '16px 8px 6px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'white', margin: 0, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' as const }}>{photo.title}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}