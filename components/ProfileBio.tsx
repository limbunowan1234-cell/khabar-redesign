'use client';
import { useState, useEffect } from 'react';

// Week 41 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export default function ProfileBio({ userId }: { userId: string }) {
  const [bio, setBio] = useState('');
  useEffect(() => {
    let alive = true;
    fetch(WORKER_URL + '/profiles/' + encodeURIComponent(userId))
      .then((r) => r.ok ? r.json() : null)
      .then((row) => { if (alive && row && row.bio) setBio(row.bio); })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  if (!bio) return null;
  return <p style={{ fontSize: '14px', opacity: 0.92, margin: '6px auto 0', maxWidth: '420px', lineHeight: 1.5, padding: '0 16px' }}>{bio}</p>;
}
