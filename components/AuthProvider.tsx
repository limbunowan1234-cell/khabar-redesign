'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initAuth, user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await initAuth();
      setLoading(false);
    }
    init();
  }, []);

  // Bridge: if running inside the KhabarDarjeeling RN app WebView, tell the app who's logged in
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isInApp = /KhabarDarjeelingApp/i.test(navigator.userAgent);
    if (!isInApp) return;
    const w = window as any;
    if (!w.ReactNativeWebView) return;
    if (user?.$id) {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'AUTH', userId: user.$id }));
    } else {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'LOGOUT' }));
    }
  }, [user?.$id]);

  if (loading) {
    return (
      <>
        <style>{'.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #c41e3a 0%, #a01830 100%)' }}>
          <div style={{ textAlign: 'center' }}>
            <img src="/assets/logo.png" alt="KhabarDarjeeling" style={{ width: '80px', height: '80px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', marginBottom: '20px', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '800', margin: '0 0 6px' }}>Khabar Darjeeling</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', margin: '0 0 30px' }}>Hamro Khabar, Hami Lekhaw</p>
            <div className="spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', margin: '0 auto' }} />
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginTop: '16px' }}>Loading latest news...</p>
          </div>
        </div>
      </>
    );
  }

  return <>{children}</>;
}
