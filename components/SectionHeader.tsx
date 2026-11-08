import Link from 'next/link';

// Newspaper-style section label: a heavy rule above, a small caps title, and
// an optional "View all" link on the right.
export default function SectionHeader({ title, viewAllHref }: { title: string; viewAllHref?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px', paddingTop: '9px', borderTop: '3px solid var(--rule-strong)' }}>
      <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '1.2px', color: 'var(--color-text)', margin: 0 }}>
        {title}
      </h2>
      {viewAllHref && (
        <Link href={viewAllHref} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 700 }}>
          View all &rarr;
        </Link>
      )}
    </div>
  );
}
