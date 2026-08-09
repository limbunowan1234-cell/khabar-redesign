'use client';

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
          <div style={{ position: 'relative', height: '340px', borderRadius: '4px', overflow: 'hidden', background: 'var(--color-surface)' }}>
            {story.imageUrl && (
              <img src={story.imageUrl} alt={story.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
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
          <div style={{ position: 'relative', height: '150px', borderRadius: '4px', overflow: 'hidden', background: 'var(--color-surface)' }}>
            {story.imageUrl && (
              <img src={story.imageUrl} alt={story.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
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
          <div style={{ width: '90px', height: '68px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', background: 'var(--color-surface)' }}>
            {story.imageUrl && (
              <img src={story.imageUrl} alt={story.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
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
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ width: '70px', height: '56px', flexShrink: 0, borderRadius: '4px', overflow: 'hidden', background: 'var(--color-surface)' }}>
          {story.imageUrl && (
            <img src={story.imageUrl} alt={story.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <div>
          <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '14px', lineHeight: 1.3, margin: '0 0 4px', color: 'var(--color-text)' }}>{story.title}</h3>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
            {story.genre && <span>{story.genre} &middot; </span>}
            {story.publishedAt ? new Date(story.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
          </div>
        </div>
      </div>
    </Link>
  );
}