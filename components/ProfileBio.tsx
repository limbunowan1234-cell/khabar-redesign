'use client';
import { useState, useEffect } from 'react';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

export default function ProfileBio({ userId }: { userId: string }) {
  const [bio, setBio] = useState('');
  useEffect(() => {
    let alive = true;
    const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] }));
    fetch(ENDPOINT + '/databases/' + DB + '/collections/profiles/documents?queries[]=' + q1 + '&queries[]=' + q2, { headers: H, credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (alive && d) { const row = (d.documents || [])[0]; if (row && row.bio) setBio(row.bio); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  if (!bio) return null;
  return <p style={{ fontSize: '14px', opacity: 0.92, margin: '6px auto 0', maxWidth: '420px', lineHeight: 1.5, padding: '0 16px' }}>{bio}</p>;
}
