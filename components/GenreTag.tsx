import Link from 'next/link';

export default function GenreTag({ genre, href }: { genre: string; href?: string }) {
  const style = {
    display: 'inline-block',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-caption)',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
    color: 'var(--color-primary)',
    textDecoration: 'none',
  };

  if (href) {
    return <Link href={href} style={style}>{genre}</Link>;
  }
  return <span style={style}>{genre}</span>;
}