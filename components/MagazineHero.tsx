'use client';

import StoryCard from './StoryCard';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';

function imgOf(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  if (!a?.imageFileId) return '';
  return ENDPOINT + '/storage/buckets/article-image/files/' + a.imageFileId + '/preview?width=1200&quality=70&project=' + PROJECT;
}

function genreOf(a: any): string {
  return a?.genre || a?.category || 'News';
}

function deckOf(a: any): string {
  const text = (a?.content || a?.summary || '').trim();
  if (!text) return '';
  return text.length > 130 ? text.slice(0, 130).trim() + '...' : text;
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
  const featured = articles.filter((a: any) => a.isFeatured);
  const pool = featured.length >= 4 ? featured : [...featured, ...articles.filter((a: any) => !a.isFeatured)];
  const main = pool[0];
  const side = pool.slice(1, 3);

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