'use client';

import StoryCard from './StoryCard';
import SectionHeader from './SectionHeader';
import { selectHeroPool, selectLatestRoundRobin } from '@/lib/homepageSelection';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';

function imgOf(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  if (!a?.imageFileId) return '';
  return ENDPOINT + '/storage/buckets/article-image/files/' + a.imageFileId + '/preview?width=192&quality=65&project=' + PROJECT;
}

function toStory(a: any) {
  return {
    $id: a.$id,
    slug: a.slug,
    title: a.title,
    imageUrl: imgOf(a),
    genre: a.genre || a.category || 'News',
    authorName: a.submitterName || a.authorName || 'Staff Reporter',
    publishedAt: a.publishedAt,
  };
}

export default function LatestSection({ articles }: { articles: any[] }) {
  const { main, side } = selectHeroPool(articles);
  const excludeIds = new Set<string>([main?.$id, ...side.map((s: any) => s.$id)].filter(Boolean));
  const latest = selectLatestRoundRobin(articles, excludeIds, 10);

  if (latest.length === 0) return null;

  return (
    <div style={{ marginBottom: '32px' }}>
      <SectionHeader title="Latest" />
      <div>
        {latest.map((a: any) => (
          <StoryCard key={a.$id} story={toStory(a)} variant="list" />
        ))}
      </div>
    </div>
  );
}