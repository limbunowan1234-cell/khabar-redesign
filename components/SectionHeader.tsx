import Link from 'next/link';

export default function SectionHeader({ title, viewAllHref }: { title: string; viewAllHref?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid var(--color-text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '4px', height: '16px', backgroundColor: 'var(--color-primary)', display: 'inline-block' }} />
        <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--color-text)', margin: 0 }}>
          {title}
        </h2>
      </div>
      {viewAllHref && (
        <Link href={viewAllHref} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-caption)', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
          View all &rarr;
        </Link>
      )}
    </div>
  );
}