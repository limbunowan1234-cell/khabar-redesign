import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import StoryCard from '@/components/StoryCard';
import SiteFooter from '@/components/SiteFooter';
import { truncateChars } from '@/lib/textPreview';
import { TOPICS, getTopic, matchesTopic } from '@/lib/topics';

const SITE = 'https://khabardarjeeling.in';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export const revalidate = 600;

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

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
    deck: truncateChars(a.content || a.summary || '', 130),
    imageUrl: imgOf(a),
    genre: a.genre || a.category,
    authorName: a.submitterName || a.authorName || 'Staff Reporter',
    authorId: a.submitterId,
    publishedAt: a.publishedAt,
  };
}

// No text search in the article API, so scan the most recent 300 published
// articles. Cached for 10 minutes like the rest of the page.
async function fetchRecentArticles(): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?limit=300', { next: { revalidate: 600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) return { title: 'Not Found' };
  return {
    title: topic.name + ' News',
    description: topic.description,
    alternates: { canonical: SITE + '/topic/' + slug },
    openGraph: {
      title: topic.name + ' News | Khabar Darjeeling',
      description: topic.description,
      url: SITE + '/topic/' + slug,
      siteName: 'Khabar Darjeeling',
      type: 'website',
    },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  const articles = (await fetchRecentArticles()).filter((a) => matchesTopic(a, topic)).slice(0, 40);
  const [lead, ...rest] = articles;

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: topic.name, item: SITE + '/topic/' + slug },
    ],
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div style={{ background: '#c41e3a', color: 'white', padding: '14px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href='/' style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', textDecoration: 'none' }}><img src='/assets/logo.png' alt='Khabar Darjeeling' style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }} /><span style={{ fontSize: '18px', fontWeight: 800 }}>Khabar Darjeeling</span></Link>
          <Link href='/' style={{ background: 'white', color: '#c41e3a', padding: '8px 18px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Home</Link>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 12px' }}>{topic.name}</h1>
        <p style={{ fontSize: '16px', lineHeight: 1.6, color: 'var(--color-text-muted)', margin: '0 0 20px', maxWidth: '720px' }}>{topic.intro}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '0 0 32px' }}>
          {TOPICS.filter((t) => t.slug !== slug).map((t) => (
            <Link key={t.slug} href={'/topic/' + t.slug} style={{ fontSize: '13px', fontWeight: 600, color: '#c41e3a', border: '1px solid #c41e3a', borderRadius: '16px', padding: '4px 12px', textDecoration: 'none' }}>{t.name}</Link>
          ))}
        </div>

        {articles.length === 0 ? (
          <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No {topic.name} stories yet - check back soon.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '32px', maxWidth: '700px' }}>
              <StoryCard story={toStory(lead)} variant="hero" />
            </div>
            {rest.length > 0 && (
              <>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>More on {topic.name}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '28px' }}>
                  {rest.map((a: any) => (
                    <StoryCard key={a.$id} story={toStory(a)} variant='secondary' />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
