import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';

// Shown with a real 404 status whenever a route calls notFound() or no route
// matches. The layout's title template adds "| Khabar Darjeeling".
export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Page not found</h1>
        <p style={{ fontSize: '15px', color: 'var(--color-text-muted)', margin: 0, maxWidth: '480px' }}>The story or section you were looking for doesn&apos;t exist or has been moved.</p>
        <Link href='/' style={{ color: '#c41e3a', fontWeight: 700, textDecoration: 'none' }}>Back to Home</Link>
      </div>
      <SiteFooter />
    </div>
  );
}
