'use client';

import Image from 'next/image';
import Link from 'next/link';
import Byline, { timeAgo } from './Byline';
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

const GENRE_ICON: Record<string, string> = {
  'Voice of People': '🗣️',
  'Poetry': '🖋️',
  'Editorial': '✍️',
  'Tourism': '🏔️',
  'Politics': '🏛️',
  'Culture': '🎭',
  'Health': '⚕️',
  'Education': '🎓',
  'Technology': '💻',
  'Sports': '⚽',
  'Business': '💼',
};

// A story with no photo gets a quiet neutral block rather than a coloured
// gradient, so the page reads as a newspaper, not a card gallery.
const PLACEHOLDER_BG = 'var(--panel-bg)';

function iconFor(genre?: string) {
  return (genre && GENRE_ICON[genre]) || '📰';
}

function ImageBlock({ story, ratio }: { story: Story; ratio: string }) {
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: ratio, borderRadius: '2px', overflow: 'hidden', background: PLACEHOLDER_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: '28px', opacity: 0.35 }}>{iconFor(story.genre)}</span>
      {story.imageUrl && (
        <Image
          src={story.imageUrl}
          alt={story.title}
          fill
          sizes='(max-width: 768px) 100vw, 640px'
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
  const linkStyle = { textDecoration: 'none', color: 'inherit', display: 'block' } as const;

  if (variant === 'hero') {
    return (
      <Link href={href} className="kd-story" style={linkStyle}>
        <div>
          <ImageBlock story={story} ratio="16 / 9" />
          {story.genre && <div style={{ marginTop: '14px' }}><GenreTag genre={story.genre} /></div>}
          <h2 className="kd-headline" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.7rem, 1rem + 2.4vw, 2.5rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.01em', margin: '6px 0 10px', color: 'var(--color-text)' }}>{story.title}</h2>
          {story.deck && <p style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--color-text-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>{story.deck}</p>}
          <Byline author={story.authorName || 'Staff Reporter'} date={story.publishedAt} readingTime={story.readingTime} />
        </div>
      </Link>
    );
  }

  if (variant === 'secondary') {
    return (
      <Link href={href} className="kd-story" style={linkStyle}>
        <div>
          <ImageBlock story={story} ratio="16 / 10" />
          {story.genre && <div style={{ marginTop: '10px' }}><GenreTag genre={story.genre} /></div>}
          <h3 className="kd-headline" style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-h3)', fontWeight: 700, lineHeight: 1.28, margin: '5px 0 8px', color: 'var(--color-text)' }}>{story.title}</h3>
          <Byline author={story.authorName || 'Staff Reporter'} date={story.publishedAt} />
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link href={href} className="kd-story" style={linkStyle}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ width: '96px', flexShrink: 0 }}>
            <ImageBlock story={story} ratio="4 / 3" />
          </div>
          <div style={{ minWidth: 0 }}>
            {story.genre && <GenreTag genre={story.genre} />}
            <h3 className="kd-headline" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '15px', lineHeight: 1.3, margin: '3px 0 4px', color: 'var(--color-text)' }}>{story.title}</h3>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-text-muted)' }}>{story.publishedAt ? timeAgo(story.publishedAt) : ''}</div>
          </div>
        </div>
      </Link>
    );
  }

  // variant === 'list': text on the left, thumbnail on the right
  return (
    <Link href={href} className="kd-story" style={linkStyle}>
      <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--rule)' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {story.genre && <GenreTag genre={story.genre} />}
          <h3 className="kd-headline" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '18px', lineHeight: 1.3, margin: '4px 0 6px', color: 'var(--color-text)' }}>{story.title}</h3>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {story.authorName && <span>By {story.authorName}</span>}
            {story.publishedAt && <span>{story.authorName ? ' · ' : ''}{timeAgo(story.publishedAt)}</span>}
          </div>
        </div>
        <div style={{ width: '120px', flexShrink: 0 }}>
          <ImageBlock story={story} ratio="3 / 2" />
        </div>
      </div>
    </Link>
  );
}
