import Link from 'next/link';
import styles from './apps.module.css';
import { appHref, categoryMeta, formatCount, formatFileSize, imageUrl, primaryAction, type DownloadItem } from '@/lib/downloadCategories';

// Older listings were added before taglines existed -- fall back to the
// start of the description so cards never look empty.
export function blurb(item: Pick<DownloadItem, 'tagline' | 'description'>, max = 90): string {
  if (item.tagline) return item.tagline;
  const first = (item.description || '').split(/\n|\. /)[0].trim();
  return first.length > max ? first.slice(0, max - 1).trimEnd() + '…' : first;
}

export function AppIcon({ item, className, fallbackClassName }: { item: Pick<DownloadItem, 'iconFileId' | 'category' | 'title'>; className: string; fallbackClassName?: string }) {
  if (item.iconFileId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl(item.iconFileId)} alt="" className={className} loading="lazy" />;
  }
  return (
    <div className={className + ' ' + (fallbackClassName || '')} aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7em' }}>
      {categoryMeta(item.category).emoji}
    </div>
  );
}

// "4.5 ★ (12)", the way app stores show it on listings. Nothing until an
// app has at least one rating.
export function RatingBadge({ item, className }: { item: Pick<DownloadItem, 'ratingCount' | 'ratingAverage'>; className?: string }) {
  if (!item.ratingCount || item.ratingAverage == null) return null;
  return (
    <span className={styles.rating + (className ? ' ' + className : '')} aria-label={`Rated ${item.ratingAverage.toFixed(1)} out of 5 from ${item.ratingCount} rating${item.ratingCount === 1 ? '' : 's'}`}>
      <strong>{item.ratingAverage.toFixed(1)}</strong>
      <span aria-hidden="true" className={styles.ratingStar}>★</span>
      <span>({formatCount(item.ratingCount)})</span>
    </span>
  );
}

// `preview` renders the same card with no links, for the submit form's live preview.
export default function AppCard({ item, preview = false }: { item: DownloadItem; preview?: boolean }) {
  const cat = categoryMeta(item.category);
  const action = preview ? { label: 'Get', href: '#', external: false } : primaryAction(item);
  const size = formatFileSize(item.sizeBytes);
  const shots = item.screenshots.slice(0, 3);

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <AppIcon item={item} className={styles.cardIcon} />
        <div className={styles.cardText}>
          <h3 className={styles.cardName}>
            {preview ? (item.title || 'Your app name') : <Link href={appHref(item)} className={styles.stretch}>{item.title}</Link>}
          </h3>
          <p className={styles.cardTagline}>{blurb(item) || (preview ? 'Your one-line tagline appears here' : '')}</p>
          <RatingBadge item={item} />
        </div>
      </div>

      {shots.length > 0 && (
        <div className={styles.cardShots}>
          {shots.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={id} src={imageUrl(id)} alt="" className={styles.cardShot} loading="lazy" />
          ))}
        </div>
      )}

      <div className={styles.cardFoot}>
        <div className={styles.meta}>
          <span className={styles.tag}>{cat.emoji} {cat.label}</span>
          {size && <span>{size}</span>}
          {item.downloadCount > 0 && <span>&middot; {formatCount(item.downloadCount)} download{item.downloadCount === 1 ? '' : 's'}</span>}
        </div>
        {action && (
          preview ? (
            <span className={styles.get}>{action.label}</span>
          ) : (
            <a href={action.href} className={styles.get} rel="nofollow noopener" target={action.external ? '_blank' : undefined}>{action.label}</a>
          )
        )}
      </div>
    </article>
  );
}
