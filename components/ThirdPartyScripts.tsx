'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

// Ads (Infolinks, AdSense) and analytics (Google Analytics, Cloudflare Web
// Analytics) for the website only. Skipped inside the Khabar Darjeeling
// Android app's WebView (user agent contains "KhabarDarjeelingApp"):
// the app is declared on Google Play as having no ads and no analytics,
// and Play counts anything shown in an app's WebView as part of the app.
// Decided after mount, so on the website the scripts still load at the
// same point as before (next/script "afterInteractive").
export default function ThirdPartyScripts() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!/KhabarDarjeelingApp/i.test(navigator.userAgent)) setAllowed(true);
  }, []);

  if (!allowed) return null;
  return (
    <>
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
    </>
  );
}
