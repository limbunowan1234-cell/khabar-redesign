'use client';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { initAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      await initAuth();
      setLoading(false);
    }
    init();
  }, []);

  if (loading) {
    return (
      <html>
        <head>
          <title>Khabar Darjeeling - The Digital Home of Darjeeling</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta charSet="utf-8" />
        </head>
        <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
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
        </body>
      </html>
    );
  }

  return (
    <html>
      <head>
        <title>Khabar Darjeeling - The Digital Home of Darjeeling</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Latest news from Darjeeling and Gorkha community" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}