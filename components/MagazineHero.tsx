'use client';

import StoryCard from './StoryCard';
import { selectHeroPool } from '@/lib/homepageSelection';
import { truncateChars } from '@/lib/textPreview';

// Week 2 of the Cloudflare migration (see cloudflare/README.md): images
// read from the R2 CDN route instead of Appwrite.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function imgOf(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  if (!a?.imageFileId) return '';
  return WORKER_URL + '/cdn/articles/' + a.imageFileId;
}

function genreOf(a: any): string {
  return a?.genre || a?.category || 'News';
}

function deckOf(a: any): string {
  return truncateChars(a?.content || a?.summary || '', 130);
}

function readingTimeOf(a: any): string {
  const words = (a?.content || '').split(' ').length;
  return Math.max(1, Math.ceil(words / 200)) + ' min read';
}

function toStory(a: any) {
  return {
    $id: a.$id,
    slug: a.slug,
    title: a.title,
    deck: deckOf(a),
    imageUrl: imgOf(a),
    genre: genreOf(a),
    authorName: a.submitterName || a.authorName || 'Staff Reporter',
    authorId: a.submitterId,
    publishedAt: a.publishedAt,
    readingTime: readingTimeOf(a),
  };
}

export default function MagazineHero({ articles }: { articles: any[]; isDarkMode?: boolean }) {
  const { main, side } = selectHeroPool(articles);
  if (!main) return null;

  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.9fr 1fr', gap: '28px' }} className="mag-hero-responsive">
        <StoryCard story={toStory(main)} variant="hero" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {side.map((a: any) => (
            <StoryCard key={a.$id} story={toStory(a)} variant="secondary" />
          ))}
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .mag-hero-responsive { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
