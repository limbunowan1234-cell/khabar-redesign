'use client';

import StoryCard from './StoryCard';
import SectionHeader from './SectionHeader';
import { selectHeroPool, selectLatestRoundRobin } from '@/lib/homepageSelection';

// Week 2 of the Cloudflare migration (see cloudflare/README.md): images
// read from the R2 CDN route instead of Appwrite.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

function imgOf(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  if (!a?.imageFileId || ['Text', 'null', 'undefined', ''].includes(String(a.imageFileId))) return '';
  return WORKER_URL + '/cdn/articles/' + a.imageFileId;
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