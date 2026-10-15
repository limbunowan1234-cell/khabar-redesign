'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './apps.module.css';
import AppCard, { AppIcon, blurb } from './AppCard';
import {
  DOWNLOAD_CATEGORIES, appHref, categoryMeta, formatCount, imageUrl, primaryAction, type DownloadItem,
} from '@/lib/downloadCategories';

type Sort = 'new' | 'popular' | 'az';

function FeaturedCard({ item }: { item: DownloadItem }) {
  const bg = imageUrl(item.iconFileId);
  const shot = item.screenshots[0];
  return (
    <Link href={appHref(item)} className={styles.feat}>
      {bg && <div className={styles.featBg} style={{ backgroundImage: 'url(' + bg + ')' }} />}
      <div className={styles.featShade} />
      {shot && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl(shot)} alt="" className={styles.featShot} loading="lazy" />
      )}
      <div className={styles.featBody}>
        <span className={styles.featKicker}>{categoryMeta(item.category).label}{item.featured ? ' · Featured' : ''}</span>
        <div className={styles.featRow}>
          <AppIcon item={item} className={styles.featIcon} />
          <div style={{ minWidth: 0 }}>
            <h3 className={styles.featName}>{item.title}</h3>
            <p className={styles.featTag}>{blurb(item, 80)}</p>
          </div>
        </div>
        <span className={styles.featGo}>View app</span>
      </div>
    </Link>
  );
}

function ChartRow({ item, rank }: { item: DownloadItem; rank: number }) {
  const cat = categoryMeta(item.category);
  const action = primaryAction(item);
  return (
    <div className={styles.chartRow}>
      <span className={styles.rank}>{rank}</span>
      <AppIcon item={item} className={styles.rowIcon} />
      <div className={styles.rowText}>
        <p className={styles.rowName}><Link href={appHref(item)} className={styles.stretch}>{item.title}</Link></p>
        <p className={styles.rowMeta}>
          {cat.label}{item.downloadCount > 0 ? ' · ' + formatCount(item.downloadCount) + ' download' + (item.downloadCount === 1 ? '' : 's') : ''}
        </p>
      </div>
      {action && <a href={action.href} className={styles.get} rel="nofollow noopener" target={action.external ? '_blank' : undefined}>{action.label}</a>}
    </div>
  );
}

export default function AppsClient({ items }: { items: DownloadItem[] }) {
  const [active, setActive] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('new');

  // Deep links like /apps#games open straight on that category.
  useEffect(() => {
    const fromHash = window.location.hash.replace('#', '');
    if (DOWNLOAD_CATEGORIES.some((c) => c.key === fromHash)) setActive(fromHash);
  }, []);

  function choose(key: string) {
    setActive(key);
    history.replaceState(null, '', key === 'all' ? window.location.pathname : '#' + key);
  }

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || active !== 'all';

  const results = useMemo(() => {
    let list = items.filter((i) => active === 'all' || i.category === active);
    if (q) {
      list = list.filter((i) => [i.title, i.tagline, i.developerName, i.description].some((f) => (f || '').toLowerCase().includes(q)));
    }
    const sorted = [...list];
    if (sort === 'popular') sorted.sort((a, b) => b.downloadCount - a.downloadCount || b.createdAt.localeCompare(a.createdAt));
    else if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [items, active, q, sort]);

  const spotlight = useMemo(() => {
    const flagged = items.filter((i) => i.featured);
    if (flagged.length) return flagged.slice(0, 6);
    return [...items].sort((a, b) => b.downloadCount - a.downloadCount || b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  }, [items]);

  const chart = useMemo(
    () => [...items].sort((a, b) => b.downloadCount - a.downloadCount || b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [items],
  );

  const countFor = (key: string) => (key === 'all' ? items.length : items.filter((i) => i.category === key).length);
  const tabs = [{ key: 'all', label: 'All', emoji: '' }, ...DOWNLOAD_CATEGORIES];

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Khabar Apps</p>
          <h1 className={styles.heroTitle}>Apps &amp; games from the hills</h1>
          <p className={styles.heroSub}>
            Discover apps, games and tools made in Darjeeling, Sikkim and across the Gorkha community &mdash; or share your own.
          </p>
          <div className={styles.search}>
            <span className={styles.searchIcon} aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps, games, developers"
              aria-label="Search apps"
              className={styles.searchInput}
            />
          </div>
        </div>
      </section>

      <div className={styles.shell}>
        {items.length === 0 ? (
          <div className={`${styles.empty} ${styles.pull}`}>
            <span className={styles.emptyEmoji}>📱</span>
            <strong style={{ display: 'block', fontSize: '18px', color: 'var(--ap-text)', marginBottom: '6px' }}>The store is opening soon</strong>
            Be the first to put your app here.
            <div style={{ marginTop: '18px' }}>
              <Link href="/apps/submit" className={styles.cta}>Submit your app</Link>
            </div>
          </div>
        ) : (
          <>
            {!filtering && spotlight.length > 0 && (
              <div className={styles.pull}>
                <div className={styles.rail}>
                  {spotlight.map((item) => <FeaturedCard key={item.$id} item={item} />)}
                </div>
              </div>
            )}

            <div className={styles.bar} style={filtering ? { marginTop: 0 } : undefined}>
              <div className={styles.barInner}>
                <div className={styles.chips} role="tablist" aria-label="Categories">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={active === t.key}
                      onClick={() => choose(t.key)}
                      className={`${styles.chip} ${active === t.key ? styles.chipOn : ''}`}
                    >
                      {t.emoji ? t.emoji + ' ' : ''}{t.label}<span className={styles.chipCount}>{countFor(t.key)}</span>
                    </button>
                  ))}
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={styles.sort} aria-label="Sort apps">
                  <option value="new">Newest</option>
                  <option value="popular">Most downloaded</option>
                  <option value="az">A to Z</option>
                </select>
              </div>
            </div>

            {!filtering && chart.length >= 3 && (
              <>
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>Top downloads</h2>
                  <span className={styles.sectionNote}>Most installed right now</span>
                </div>
                <div className={styles.chart}>
                  {chart.map((item, i) => <ChartRow key={item.$id} item={item} rank={i + 1} />)}
                </div>
              </>
            )}

            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>
                {q ? 'Results for “' + query.trim() + '”' : active === 'all' ? 'All apps' : categoryMeta(active).label}
              </h2>
              <span className={styles.sectionNote}>{results.length} {results.length === 1 ? 'listing' : 'listings'}</span>
            </div>

            {results.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyEmoji}>🔎</span>
                Nothing matches that. Try a different word or category.
              </div>
            ) : (
              <div className={styles.grid}>
                {results.map((item) => <AppCard key={item.$id} item={item} />)}
              </div>
            )}
          </>
        )}

        <div className={styles.band}>
          <div>
            <h2 className={styles.bandTitle}>Built something? Put it on the shelf.</h2>
            <p className={styles.bandText}>
              Submit your app or game with screenshots and links. We review every listing before it goes live, and it&apos;s free.
            </p>
          </div>
          <Link href="/apps/submit" className={`${styles.cta} ${styles.ctaOnDark}`}>Submit your app</Link>
        </div>

        <p className={styles.fine}>
          Apps are made by independent developers. Android may ask you to allow installs from your browser the first time you open an APK &mdash; only install apps from sources you trust.
          If you see a listing that looks unsafe or misleading, <Link href="/grievance" style={{ color: 'var(--ap-red)', fontWeight: 700 }}>report it to us</Link>.
        </p>
      </div>
    </>
  );
}
