import Link from 'next/link';

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return min + 'm ago';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    const day = Math.floor(hr / 24);
    if (day < 7) return day + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function Byline({
  author,
  authorId,
  date,
  readingTime,
}: {
  author: string;
  authorId?: string;
  date?: string;
  readingTime?: string;
}) {
  const authorEl = authorId ? (
    <Link href={'/profile/' + authorId} style={{ color: 'inherit', textDecoration: 'none' }}>{author}</Link>
  ) : (
    <span>{author}</span>
  );

  return (
    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-meta)', color: 'var(--color-text-muted)', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>By {authorEl}</span>
      {date && <span>&middot; {timeAgo(date)}</span>}
      {readingTime && <span>&middot; {readingTime}</span>}
    </div>
  );
}