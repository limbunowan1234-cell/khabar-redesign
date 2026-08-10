'use client';

import Image from 'next/image';
import Link from 'next/link';
import Byline from './Byline';
import GenreTag from './GenreTag';

interface Story {
  $id: string;
  slug?: string;
  title: string;
  deck?: string;
  imageUrl?: string;
  genre?: string;
  authorName?: string;
  authorId?: string;
  publishedAt?: string;
  readingTime?: string;
}

const GENRE_STYLE: Record<string, { gradient: string; icon: string }> = {
  'Voice of People': { gradient: 'linear-gradient(135deg, #f59e0b, #c2410c)', icon: '🗣️' },
  'Poetry': { gradient: 'linear-gradient(135deg, #a855f7, #6b21a8)', icon: '🖋️' },
  'Editorial': { gradient: 'linear-gradient(135deg, #374151, #111827)', icon: '✍️' },
  'Tourism': { gradient: 'linear-gradient(135deg, #06b6d4, #0e7490)', icon: '🏔️' },
  'Politics': { gradient: 'linear-gradient(135deg, #c41e3a, #7a1220)', icon: '🏛️' },
  'Culture': { gradient: 'linear-gradient(135deg, #ec4899, #9d174d)', icon: '🎭' },
  'Health': { gradient: 'linear-gradient(135deg, #22c55e, #15803d)', icon: '⚕️' },
  'Education': { gradient: 'linear-gradient(135deg, #3b82f6, #1e3a8a)', icon: '🎓' },
  'Technology': { gradient: 'linear-gradient(135deg, #64748b, #1e293b)', icon: '💻' },
  'Sports': { gradient: 'linear-gradient(135deg, #f97316, #9a3412)', icon: '⚽' },
  'Business': { gradient: 'linear-gradient(135deg, #eab308, #854d0e)', icon: '💼' },
};
const DEFAULT_STYLE = { gradient: 'linear-gradient(135deg, #94a3b8, #475569)', icon: '📰' };

function styleFor(genre?: string) {
  if (genre && GENRE_STYLE[genre]) return GENRE_STYLE[genre];
  return DEFAULT_STYLE;
}

function ImageBlock({ story, height }: { story: Story; height: string }) {
  const s = styleFor(story.genre);
  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: '4px', overflow: 'hidden', background: s.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '28px', opacity: 0.55 }}>{s.icon}</span>
      {story.imageUrl && (
        <Image
          src={story.imageUrl}
          alt={story.title}
          fill
          sizes='(max-width: 768px) 100vw, 400px'
          style={{ objectFit: 'cover' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
    </div>
  );
}

export default function StoryCard({
  story,
  variant = 'secondary',
}: {
  story: Story;
  variant?: 'hero' | 'secondary' | 'compact' | 'list';
}) {
  const href = '/article/' + (story.slug || story.$id);

  if (variant === 'hero') {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div>
          <ImageBlock story={story} height="340px" />
          {story.genre && <div style={{ marginTop: '14px' }}><GenreTag genre={story.genre} /></div>}
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-h1)', lineHeight: 1.2, margin: '8px 0', color: 'var(--color-text)' }}>{story.title}</h1>
          {story.deck && <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 10px' }}>{story.deck}</p>}
          <Byline author={story.authorName || 'Staff Reporter'} date={story.publishedAt} readingTime={story.readingTime} />
        </div>
      </Link>
    );
  }

  if (variant === 'secondary') {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div>
          <ImageBlock story={story} height="150px" />
          {story.genre && <div style={{ marginTop: '10px' }}><GenreTag genre={story.genre} /></div>}
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-h3)', lineHeight: 1.3, margin: '6px 0 8px', color: 'var(--color-text)' }}>{story.title}</h3>
          <Byline author={story.authorName || 'Staff Reporter'} date={story.publishedAt} />
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ width: '90px', height: '68px', flexShrink: 0 }}>
            <ImageBlock story={story} height="68px" />
          </div>
          <div>
            {story.genre && <GenreTag genre={story.genre} />}
            <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '14px', lineHeight: 1.35, margin: '4px 0 4px', color: 'var(--color-text)' }}>{story.title}</h3>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-text-muted)' }}>{story.publishedAt ? new Date(story.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
          </div>
        </div>
      </Link>
    );
  }

  // variant === 'list'
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px 0', minHeight: '108px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ position: 'relative', width: '96px', height: '76px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', background: styleFor(story.genre).gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '20px', opacity: 0.55, position: 'absolute' }}>{styleFor(story.genre).icon}</span>
          {story.imageUrl && (
            <Image src={story.imageUrl} alt={story.title} fill sizes='96px' style={{ objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          )}
        </div>
        <div>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '16px', lineHeight: 1.35, margin: '0 0 6px', color: 'var(--color-text)' }}>{story.title}</h3>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {story.genre && <span>{story.genre} &middot; </span>}
            {story.publishedAt ? new Date(story.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
          </div>
        </div>
      </div>
    </Link>
  );
}
