import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import AuthProvider from '@/components/AuthProvider';

const SITE = 'https://khabardarjeeling.space';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Khabar Darjeeling — The Digital Home of Darjeeling',
    template: '%s | Khabar Darjeeling',
  },
  description: 'Latest news from Darjeeling, Kalimpong, Kurseong and the Gorkha community — politics, sports, culture, tea gardens, tourism and more.',
  applicationName: 'Khabar Darjeeling',
  alternates: { canonical: SITE },
  openGraph: {
    type: 'website',
    siteName: 'Khabar Darjeeling',
    title: 'Khabar Darjeeling — The Digital Home of Darjeeling',
    description: 'Latest news from Darjeeling and the Gorkha community.',
    url: SITE,
    images: [{ url: '/assets/logo.png', width: 1200, height: 630, alt: 'Khabar Darjeeling' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Khabar Darjeeling — The Digital Home of Darjeeling',
    description: 'Latest news from Darjeeling and the Gorkha community.',
    images: ['/assets/logo.png'],
  },
  icons: { icon: '/assets/logo.png', apple: '/assets/logo.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5223539471824662" crossOrigin="anonymous" strategy="afterInteractive" />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
