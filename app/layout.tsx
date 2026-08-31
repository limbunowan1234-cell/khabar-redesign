import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import AuthProvider from '@/components/AuthProvider';
import { Noto_Serif, Noto_Serif_Devanagari, Inter, Noto_Sans_Devanagari } from 'next/font/google';

const notoSerif = Noto_Serif({ subsets: ['latin'], variable: '--font-noto-serif', display: 'swap' });
const notoSerifDev = Noto_Serif_Devanagari({ subsets: ['devanagari'], weight: ['400', '600', '700'], variable: '--font-noto-serif-dev', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const notoSansDev = Noto_Sans_Devanagari({ subsets: ['devanagari'], weight: ['400', '500', '700'], variable: '--font-noto-sans-dev', display: 'swap' });

const SITE = 'https://khabardarjeeling.in';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Khabar Darjeeling - The Digital Home of Darjeeling',
    template: '%s | Khabar Darjeeling',
  },
  description: 'Latest news from Darjeeling, Kalimpong, Kurseong and the Gorkha community - politics, sports, culture, tea gardens, tourism and more.',
  applicationName: 'Khabar Darjeeling',
  alternates: { canonical: SITE },
  openGraph: {
    type: 'website',
    siteName: 'Khabar Darjeeling',
    title: 'Khabar Darjeeling - The Digital Home of Darjeeling',
    description: 'Latest news from Darjeeling and the Gorkha community.',
    url: SITE,
    images: [{ url: '/assets/logo.png', width: 1200, height: 630, alt: 'Khabar Darjeeling' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Khabar Darjeeling - The Digital Home of Darjeeling',
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
    <html lang="en" className={notoSerif.variable + " " + notoSerifDev.variable + " " + inter.variable + " " + notoSansDev.variable}>

      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (/KhabarDarjeelingApp/.test(navigator.userAgent)) {
                    var meta = document.querySelector('meta[name="viewport"]');
                    if (!meta) {
                      meta = document.createElement('meta');
                      meta.name = 'viewport';
                      document.head.appendChild(meta);
                    }
                    meta.setAttribute('content', 'width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no');
                    var style = document.createElement('style');
                    style.innerHTML = 'html,body{width:100vw!important;max-width:100vw!important;overflow-x:hidden!important}';
                    document.head.appendChild(style);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>

      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <Script id="infolinks-config" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: "var infolinks_pid = 3446930; var infolinks_wsid = 0;" }} />
        <Script async src="//resources.infolinks.com/js/infolinks_main.js" strategy="afterInteractive" />
        <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5223539471824662" crossOrigin="anonymous" strategy="afterInteractive" />
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-0RGSS346WD" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive" dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-0RGSS346WD');
          `,
        }} />
        <Script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "ec8c61ed03644636941380a15af04747"}' strategy="afterInteractive" />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
