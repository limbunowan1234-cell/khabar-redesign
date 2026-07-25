'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') || '';
  const secret = searchParams.get('secret') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    if (!userId || !secret) { setError('This reset link is invalid or has expired.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await fetch(endpoint + '/account/recovery', {
        method: 'PUT',
        headers: HJ,
        body: JSON.stringify({ userId, secret, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to reset password. The link may have expired.');
      }
      setDone(true);
      setTimeout(() => router.push('/auth'), 2500);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' }}>
      <div style={{ backgroundColor: '#c41e3a', color: 'white', padding: '20px', textAlign: 'center', borderBottom: '4px solid #f5c518' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <img src="/assets/logo.png" alt="KhabarDarjeeling" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', objectFit: 'cover' }} />
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'white' }}>Khabar Darjeeling</h1>
          </div>
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 16px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '36px 30px', maxWidth: '400px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

          {!done ? (
            <>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#fdf0f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>&#128273;</div>
              <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '800', color: '#1a1a1a', textAlign: 'center' }}>Set a new password</h2>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#888', textAlign: 'center' }}>Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#333' }}>New Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" style={{ width: '100%', padding: '12px 14px', border: '2px solid #eee', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', backgroundColor: '#fafafa', outline: 'none' }} onFocus={(e) => { e.target.style.borderColor = '#c41e3a'; }} onBlur={(e) => { e.target.style.borderColor = '#eee'; }} autoFocus />
                </div>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#333' }}>Confirm Password</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" style={{ width: '100%', padding: '12px 14px', border: '2px solid #eee', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', backgroundColor: '#fafafa', outline: 'none' }} onFocus={(e) => { e.target.style.borderColor = '#c41e3a'; }} onBlur={(e) => { e.target.style.borderColor = '#eee'; }} />
                </div>

                {error && (
                  <div style={{ padding: '12px 14px', backgroundColor: '#ffebee', color: '#c41e3a', borderRadius: '8px', fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>{error}</div>
                )}

                <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', backgroundColor: loading ? '#999' : '#c41e3a', color: 'white', border: 'none', borderRadius: '9px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'default' : 'pointer' }}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>&#10003;</div>
              <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '800', color: '#1a1a1a', textAlign: 'center' }}>Password reset!</h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#888', textAlign: 'center' }}>Redirecting you to login...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <ResetForm />
    </Suspense>
  );
}
