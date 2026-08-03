'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const ADMIN_EMAIL = 'nowanad@gmail.com';

export default function ReporterPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(endpoint + '/account', { headers: H, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const labels = (data as any).labels || [];
          const userIsAdmin = data.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
          const userIsReporter = userIsAdmin || labels.includes('reporter');
          if (!userIsReporter) {
            setError('Access denied. Reporter access only.');
            setLoading(false);
            return;
          }
          setUser(data);
          setIsAdmin(userIsAdmin);
        } else {
          setError('Please log in.');
        }
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
      <Link href="/" style={{ color: '#c41e3a' }}>Back to Home</Link>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #0F4C5C, #0a3540)', color: 'white', padding: '20px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Link href="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>Back to Site</Link>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>Khabar Reporter Panel</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>Welcome, {user?.name}{isAdmin ? ' (Admin)' : ''}</p>
          </div>
          {isAdmin && (
            <Link href="/admin" style={{ background: '#D4AF37', color: '#0F4C5C', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Full Admin Panel</Link>
          )}
        </div>
      </div>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>&#128221;</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#1a1a1a' }}>Manage Articles</h2>
          <p style={{ color: '#6b7280', marginBottom: '20px' }}>View, edit, and publish articles for Khabar Darjeeling.</p>
          <Link href='/admin' style={{ display: 'inline-block', background: '#0F4C5C', color: 'white', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700 }}>Open Article Manager</Link>
          <Link href='/reporter/post' style={{ display: 'inline-block', background: '#c41e3a', color: 'white', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontWeight: 700, marginLeft: '12px' }}>Write New Article</Link>
        </div>
      </div>
    </div>
  );
}
