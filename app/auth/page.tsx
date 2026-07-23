'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const endpoint = 'https://api.khabardarjeeling.in/v1';
const projectId = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': projectId };
const HJ = { 'X-Appwrite-Project': projectId, 'Content-Type': 'application/json' };

export default function AuthPage() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await fetch(endpoint + '/account/sessions/current', { method: 'DELETE', headers: H, credentials: 'include' }).catch(() => {});
      if (isLogin) {
        if (!email || !password) { setError('Fill in all fields'); setLoading(false); return; }
        const res = await fetch(endpoint + '/account/sessions/email', { method: 'POST', headers: HJ, credentials: 'include', body: JSON.stringify({ email, password }) });
        if (!res.ok) { const data = await res.json(); throw new Error(data.message || 'Login failed'); }
        router.push('/');
      } else {
        if (!email || !password || !name) { setError('Fill in all fields'); setLoading(false); return; }
        const signupRes = await fetch(endpoint + '/account', { method: 'POST', headers: HJ, credentials: 'include', body: JSON.stringify({ userId: 'unique()', email, password, name }) });
        if (!signupRes.ok) { const data = await signupRes.json(); throw new Error(data.message || 'Signup failed'); }
        const sessionRes = await fetch(endpoint + '/account/sessions/email', { method: 'POST', headers: HJ, credentials: 'include', body: JSON.stringify({ email, password }) });
        if (!sessionRes.ok) throw new Error('Session creation failed');
        router.push('/');
      }
    } catch (err) {
      setError((err as any)?.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5', display: 'flex', flexDirection: 'column' }}>
      <style>{'.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>

      <div style={{ backgroundColor: '#c41e3a', color: 'white', padding: '20px', textAlign: 'center', borderBottom: '4px solid #f5c518', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '6px' }}>
            <img src="/assets/logo.png" alt="KhabarDarjeeling" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'white' }}>Khabar Darjeeling</h1>
          </div>
        </Link>
        <p style={{ margin: 0, fontSize: '13px', opacity: 0.9, color: '#f5c518', fontWeight: '600' }}>{isLogin ? 'Welcome back to the Digital Home of Darjeeling!' : 'Join our community!'}</p>
      </div>

      <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ position: 'fixed', top: '16px', right: '16px', backgroundColor: '#f5c518', color: '#c41e3a', border: 'none', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', zIndex: 100, fontSize: '12px' }}>{isDarkMode ? 'Light' : 'Dark'}</button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '16px', padding: '36px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', width: '100%', maxWidth: '420px', border: isDarkMode ? '1px solid #333' : 'none' }}>

          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{isLogin ? 'Login to your account' : 'Create an account'}</h2>
            <p style={{ margin: 0, fontSize: '13px', color: isDarkMode ? '#aaa' : '#888' }}>{isLogin ? 'Stay updated with Darjeeling news' : 'Join thousands of readers'}</p>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5', borderRadius: '10px', padding: '4px' }}>
            <button onClick={() => { setIsLogin(true); setError(''); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', backgroundColor: isLogin ? '#c41e3a' : 'transparent', color: isLogin ? 'white' : isDarkMode ? '#aaa' : '#666', transition: 'all 0.2s' }}>Login</button>
            <button onClick={() => { setIsLogin(false); setError(''); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', backgroundColor: !isLogin ? '#c41e3a' : 'transparent', color: !isLogin ? 'white' : isDarkMode ? '#aaa' : '#666', transition: 'all 0.2s' }}>Sign Up</button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: isDarkMode ? '#ddd' : '#333' }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" style={{ width: '100%', padding: '12px 14px', border: '2px solid ' + (isDarkMode ? '#333' : '#eee'), borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', backgroundColor: isDarkMode ? '#2a2a2a' : '#fafafa', color: isDarkMode ? '#fff' : '#1a1a1a', outline: 'none' }} onFocus={(e) => { e.target.style.borderColor = '#c41e3a'; }} onBlur={(e) => { e.target.style.borderColor = isDarkMode ? '#333' : '#eee'; }} />
            </div>
            {!isLogin && (
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: isDarkMode ? '#ddd' : '#333' }}>Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={{ width: '100%', padding: '12px 14px', border: '2px solid ' + (isDarkMode ? '#333' : '#eee'), borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', backgroundColor: isDarkMode ? '#2a2a2a' : '#fafafa', color: isDarkMode ? '#fff' : '#1a1a1a', outline: 'none' }} onFocus={(e) => { e.target.style.borderColor = '#c41e3a'; }} onBlur={(e) => { e.target.style.borderColor = isDarkMode ? '#333' : '#eee'; }} />
              </div>
            )}
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: isDarkMode ? '#ddd' : '#333' }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" style={{ width: '100%', padding: '12px 14px', border: '2px solid ' + (isDarkMode ? '#333' : '#eee'), borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box', backgroundColor: isDarkMode ? '#2a2a2a' : '#fafafa', color: isDarkMode ? '#fff' : '#1a1a1a', outline: 'none' }} onFocus={(e) => { e.target.style.borderColor = '#c41e3a'; }} onBlur={(e) => { e.target.style.borderColor = isDarkMode ? '#333' : '#eee'; }} />
            </div>
            {error && (
              <div style={{ padding: '12px 14px', backgroundColor: '#ffebee', color: '#c41e3a', borderRadius: '8px', fontSize: '14px', fontWeight: '500', borderLeft: '4px solid #c41e3a' }}>{error}</div>
            )}
            <button type="submit" disabled={loading} style={{ padding: '14px', backgroundColor: loading ? '#999' : '#c41e3a', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '16px', marginTop: '4px' }}>
              {loading ? 'Processing...' : isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid ' + (isDarkMode ? '#333' : '#eee'), textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: isDarkMode ? '#aaa' : '#888' }}>
              {isLogin ? 'New to Khabar Darjeeling?' : 'Already have an account?'}
              <button onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{ background: 'none', border: 'none', color: '#c41e3a', fontWeight: '700', cursor: 'pointer', fontSize: '13px', marginLeft: '4px' }}>
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </p>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <button style={{ width: '100%', padding: '12px', backgroundColor: 'transparent', border: '2px solid ' + (isDarkMode ? '#444' : '#eee'), borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: isDarkMode ? '#aaa' : '#666' }}>Back to Home</button>
            </Link>
          </div>

          <div style={{ marginTop: '20px', padding: '16px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fff8e1', borderRadius: '8px', borderLeft: '4px solid #f5c518' }}>
            <p style={{ margin: 0, fontSize: '12px', color: isDarkMode ? '#aaa' : '#666', lineHeight: '1.5' }}>
              By continuing, you agree to receive news updates from Darjeeling and the Gorkha community.
            </p>
          </div>
        </div>
      </div>

      <footer style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#1a1a1a', color: '#aaa', padding: '16px', textAlign: 'center', fontSize: '13px' }}>
        <p style={{ margin: 0 }}>© 2026 Khabar Darjeeling. All rights reserved.</p>
      </footer>
    </div>
  );
}
