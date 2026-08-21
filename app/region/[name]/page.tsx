import type { Metadata } from 'next';
import Link from 'next/link';
import StoryCard from '@/components/StoryCard';
import SiteFooter from '@/components/SiteFooter';

const SITE = 'https://khabardarjeeling.in';
// Week 4 of the Cloudflare migration (see cloudflare/README.md).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

const REGIONS = ['Darjeeling', 'Kalimpong', 'Kurseong', 'Mirik', 'Siliguri', 'West Bengal', 'Sikkim', 'National', 'World'];

const REGION_DESCRIPTIONS: Record<string, string> = {
  'Darjeeling': 'News and stories from Darjeeling town and the surrounding hills.',
  'Kalimpong': 'News and stories from Kalimpong district.',
  'Kurseong': 'News and stories from Kurseong.',
  'Mirik': 'News and stories from Mirik.',
  'Siliguri': 'News and stories from Siliguri and the plains.',
  'West Bengal': 'News from across West Bengal.',
  'Sikkim': 'News and stories from Sikkim.',
  'National': 'National news coverage from across India.',
  'World': 'International news and global coverage.',
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function unslugify(slug: string): string | null {
  return REGIONS.find((r) => slugify(r) === slug) || null;
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
    deck: (a.content || a.summary || '').trim().slice(0, 130),
    imageUrl: imgOf(a),
    genre: a.genre || a.category,
    authorName: a.submitterName || a.authorName || 'Staff Reporter',
    authorId: a.submitterId,
    publishedAt: a.publishedAt,
  };
}

async function fetchRegionArticles(region: string): Promise<any[]> {
  try {
    const res = await fetch(WORKER_URL + '/articles?district=' + encodeURIComponent(region) + '&limit=50', {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.documents || [];
  } catch {
    return [];
  }
}

function selectHeroAndPinned(articles: any[]) {
  const featuredCandidates = articles.filter((a: any) => a.isRegionFeatured);
  const hero = featuredCandidates.length > 0 ? featuredCandidates[0] : articles[0];
  const pinned = articles.filter((a: any) => a.isRegionPinned && a.$id !== hero?.$id).slice(0, 3);
  const usedIds = new Set([hero?.$id, ...pinned.map((a: any) => a.$id)].filter(Boolean));
  const rest = articles.filter((a: any) => !usedIds.has(a.$id));
  return { hero, pinned, rest };
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const region = unslugify(name);
  if (!region) return { title: 'Not Found | Khabar Darjeeling' };
  const description = REGION_DESCRIPTIONS[region] || ('Latest news from ' + region + '.');
  return {
    title: region + ' News | Khabar Darjeeling',
    description,
    alternates: { canonical: SITE + '/region/' + name },
    openGraph: {
      title: region + ' News | Khabar Darjeeling',
      description,
      url: SITE + '/region/' + name,
      siteName: 'Khabar Darjeeling',
      type: 'website',
    },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const region = unslugify(name);

  if (!region) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>Region not found</p>
        <Link href="/" style={{ color: '#c41e3a', fontWeight: 700, textDecoration: 'none' }}>Back to Home</Link>
      </div>
    );
  }

  const articles = await fetchRegionArticles(region);
  const { hero, pinned, rest } = selectHeroAndPinned(articles);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: '#c41e3a', color: 'white', padding: '14px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href='/' style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', textDecoration: 'none' }}><img src='/assets/logo.png' alt='Khabar Darjeeling' style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }} /><span style={{ fontSize: '18px', fontWeight: 800 }}>Khabar Darjeeling</span></Link>
          <Link href='/' style={{ background: 'white', color: '#c41e3a', padding: '8px 18px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Home</Link>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 20px 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>{region}</h1>
        <p style={{ fontSize: '15px', color: 'var(--color-text-muted)', margin: '0 0 32px', maxWidth: '600px' }}>{REGION_DESCRIPTIONS[region]}</p>

        {articles.length === 0 ? (
          <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No stories from {region} yet - check back soon.
          </div>
        ) : (
          <>
            {hero && (
              <div style={{ marginBottom: '32px', maxWidth: '700px' }}>
                <StoryCard story={toStory(hero)} variant="hero" />
              </div>
            )}
            {pinned.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>Editor's Picks</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
                  {pinned.map((a: any) => (
                    <StoryCard key={a.$id} story={toStory(a)} variant="secondary" />
                  ))}
                </div>
              </div>
            )}
            {rest.length > 0 && (
              <>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>Latest Stories</h2>
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
