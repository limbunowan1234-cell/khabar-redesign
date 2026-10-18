import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '../apps.module.css';
import AppCard, { AppIcon, blurb } from '../AppCard';
import AppGallery from '../AppGallery';
import ShareBar from './ShareBar';
import Reviews from './Reviews';
import SiteFooter from '@/components/SiteFooter';
import {
  WORKER_URL, categoryMeta, downloadHref, formatCount, formatFileSize, imageUrl, type DownloadItem,
} from '@/lib/downloadCategories';

const SITE = 'https://khabardarjeeling.in';

async function fetchApp(ref: string): Promise<DownloadItem | null> {
  const res = await fetch(WORKER_URL + '/downloads/' + encodeURIComponent(ref), { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  // Anything else is a real failure -- throw so a blip isn't cached as a 404.
  if (!res.ok) throw new Error('Could not load app (' + res.status + ')');
  return res.json();
}

async function fetchRelated(category: string, selfId: string): Promise<DownloadItem[]> {
  try {
    const res = await fetch(WORKER_URL + '/downloads?category=' + encodeURIComponent(category) + '&sort=popular&limit=8', { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.documents || []) as DownloadItem[]).filter((d) => d.$id !== selfId).slice(0, 3);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchApp(slug).catch(() => null);
  if (!item) return { title: 'App not found' };
  const description = (blurb(item, 150) + (item.description ? ' ' + item.description.replace(/\s+/g, ' ').slice(0, 120) : '')).slice(0, 160);
  const url = SITE + '/apps/' + (item.slug || item.$id);
  return {
    title: item.title + ' - Free Download',
    description,
    alternates: { canonical: url },
    openGraph: {
      title: item.title + ' - Khabar Apps',
      description,
      url,
      siteName: 'Khabar Darjeeling',
      type: 'website',
      images: item.iconFileId ? [{ url: imageUrl(item.iconFileId) }] : undefined,
    },
  };
}

function when(createdAt: string): string {
  const d = new Date(createdAt.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

export default async function AppDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await fetchApp(slug);
  if (!item) notFound();

  const cat = categoryMeta(item.category);
  const related = await fetchRelated(item.category, item.$id);
  const size = formatFileSize(item.sizeBytes);
  const bg = imageUrl(item.iconFileId);
  const version = item.version ? 'v' + item.version.replace(/^v/i, '') : '';
  const added = when(item.createdAt);

  const facts: [string, string][] = [
    ['Category', cat.label],
    ...(version ? [['Version', version] as [string, string]] : []),
    ...(size ? [['Size', size] as [string, string]] : []),
    ['Downloads', formatCount(item.downloadCount)],
    ...(added ? [['Added', added] as [string, string]] : []),
  ];

  const isAndroid = /\.apk$/i.test(item.fileName || '') || !!item.playStoreUrl;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: item.title,
    description: item.description || blurb(item),
    applicationCategory: item.category === 'games' ? 'GameApplication' : 'MobileApplication',
    ...(isAndroid ? { operatingSystem: 'Android' } : {}),
    ...(item.iconFileId ? { image: imageUrl(item.iconFileId) } : {}),
    ...(item.developerName ? { author: { '@type': 'Organization', name: item.developerName } } : {}),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    url: SITE + '/apps/' + (item.slug || item.$id),
  };

  const hasLinks = !!(item.playStoreUrl || item.appStoreUrl || item.websiteUrl);
  const pageUrl = SITE + '/apps/' + (item.slug || item.$id);
  const playableOnWeb = item.slug === 'simon-speed';

  return (
    <div className={styles.root}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/" className={styles.brand}>Khabar Darjeeling</Link>
          <div className={styles.topLinks}>
            <Link href="/apps" className={styles.pillGhost}>All apps</Link>
            <Link href="/apps/submit" className={styles.pillLight}>Submit your app</Link>
          </div>
        </div>
      </div>

      <header className={styles.dHero}>
        {bg && <div className={styles.dBg} style={{ backgroundImage: 'url(' + bg + ')' }} />}
        <div className={styles.dShade} />
        <div className={styles.dInner}>
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/apps">Apps</Link> &rsaquo; <Link href={'/apps#' + cat.key}>{cat.label}</Link> &rsaquo; {item.title}
          </nav>
          <div className={styles.dMain}>
            <AppIcon item={item} className={styles.dIcon} fallbackClassName={styles.dIconFallback} />
            <div className={styles.dText}>
              <h1 className={styles.dTitle}>{item.title}</h1>
              {item.developerName && <p className={styles.dDev}>{item.developerName}</p>}
              {blurb(item, 140) && <p className={styles.dTag}>{blurb(item, 140)}</p>}
              <div className={styles.actions}>
                {item.hasDownload && (
                  <a href={downloadHref(item)} className={styles.cta} rel="nofollow noopener" target={item.hosted ? undefined : '_blank'}>
                    {item.hosted && /\.apk$/i.test(item.fileName || '') ? 'Download APK' : 'Download'}{size ? ' · ' + size : ''}
                  </a>
                )}
                {item.playStoreUrl && <a href={item.playStoreUrl} className={item.hasDownload ? `${styles.ctaGhost} ${styles.ctaGhostDark}` : styles.cta} rel="nofollow noopener" target="_blank">Google Play</a>}
                {item.appStoreUrl && <a href={item.appStoreUrl} className={styles.ctaGhost + ' ' + styles.ctaGhostDark} rel="nofollow noopener" target="_blank">App Store</a>}
                {item.websiteUrl && <a href={item.websiteUrl} className={(item.hasDownload || item.playStoreUrl || item.appStoreUrl) ? `${styles.ctaGhost} ${styles.ctaGhostDark}` : styles.cta} rel="nofollow noopener" target="_blank">Visit website</a>}
                {playableOnWeb && <Link href="/play/simon-speed" className={`${styles.ctaGhost} ${styles.ctaGhostDark}`}>Play in browser</Link>}
              </div>
              <ShareBar url={pageUrl} title={item.title} />
            </div>
          </div>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label} className={styles.fact}>
              <div className={styles.factLabel}>{label}</div>
              <div className={styles.factValue}>{value}</div>
            </div>
          ))}
        </div>

        <div className={styles.twoCol} style={{ marginTop: '22px' }}>
          <div className={styles.stack}>
            {playableOnWeb && (
              <div className={styles.playBand}>
                <div>
                  <h2>Play {item.title} in your browser</h2>
                  <p>Compete in Easy, Medium and Hard. The top 10 each month make the leaderboard.</p>
                </div>
                <Link href="/play/simon-speed" className={styles.cta}>Play now</Link>
              </div>
            )}
            {item.screenshots.length > 0 && (
              <section className={styles.panel}>
                <h2 className={styles.sectionTitle} style={{ marginBottom: '14px' }}>Inside the app</h2>
                <AppGallery shots={item.screenshots} title={item.title} />
              </section>
            )}
            {item.description && (
              <section className={styles.panel}>
                <h2 className={styles.sectionTitle} style={{ marginBottom: '12px' }}>About this app</h2>
                <p className={styles.about}>{item.description}</p>
              </section>
            )}
            <Reviews appId={item.$id} appTitle={item.title} />
          </div>

          <aside className={styles.side}>
            {(item.developerName || hasLinks) && (
              <div className={styles.panel}>
                <h3 className={styles.sideTitle}>Developer</h3>
                {item.developerName && <p style={{ margin: '0 0 8px', fontWeight: 800 }}>{item.developerName}</p>}
                {item.websiteUrl && <a href={item.websiteUrl} className={styles.sideLink} rel="nofollow noopener" target="_blank">Website &#8599;</a>}
                {item.playStoreUrl && <a href={item.playStoreUrl} className={styles.sideLink} rel="nofollow noopener" target="_blank">Google Play &#8599;</a>}
                {item.appStoreUrl && <a href={item.appStoreUrl} className={styles.sideLink} rel="nofollow noopener" target="_blank">App Store &#8599;</a>}
              </div>
            )}
            <div className={styles.panel}>
              <h3 className={styles.sideTitle}>Before you install</h3>
              <p className={styles.sideText}>
                This app is made by an independent developer, not by Khabar Darjeeling. On Android you may need to allow installs from your browser for APK files &mdash; only install from sources you trust.
              </p>
              <Link href="/grievance" className={styles.sideLink} style={{ marginTop: '8px' }}>Report this listing</Link>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>More in {cat.label}</h2>
              <Link href={'/apps#' + cat.key} className={styles.sectionNote} style={{ color: 'var(--ap-red)', fontWeight: 700, textDecoration: 'none' }}>See all &rarr;</Link>
            </div>
            <div className={styles.grid}>
              {related.map((r) => <AppCard key={r.$id} item={r} />)}
            </div>
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
