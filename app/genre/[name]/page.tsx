import type { Metadata } from 'next';
import Link from 'next/link';
import StoryCard from '@/components/StoryCard';
import SiteFooter from '@/components/SiteFooter';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const IMAGE_ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const SITE = 'https://khabardarjeeling.in';
const BUCKET = 'article-image';

const GENRES = ['Voice of People', 'Poetry', 'Editorial', 'Tourism', 'Politics', 'Culture', 'Health', 'Education', 'Technology', 'Sports', 'Business'];

const GENRE_DESCRIPTIONS: Record<string, string> = {
  'Voice of People': 'Community voices, citizen journalism, and stories from the people of the hills.',
  'Poetry': 'Original Nepali and English poetry from local writers.',
  'Editorial': 'Opinion, analysis, and long-form commentary on issues that matter.',
  'Tourism': 'Travel guides, destination features, and tourism news for Darjeeling and the hills.',
  'Politics': 'Political news and analysis from Darjeeling, the Gorkha region, and beyond.',
  'Culture': 'Culture, heritage, and traditions of the Darjeeling and Gorkha community.',
  'Health': 'Health news and wellness coverage for the hills.',
  'Education': 'Education news, school updates, and academic coverage.',
  'Technology': 'Technology and innovation news relevant to the region.',
  'Sports': 'Sports news and coverage from Darjeeling and the surrounding hills.',
  'Business': 'Business, economy, and entrepreneurship news from the region.',
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function unslugify(slug: string): string | null {
  return GENRES.find((g) => slugify(g) === slug) || null;
}

function imgOf(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  if (!a?.imageFileId) return '';
  return IMAGE_ENDPOINT + '/storage/buckets/' + BUCKET + '/files/' + a.imageFileId + '/view?project=' + PROJECT;
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

async function fetchGenreArticles(genre: string): Promise<any[]> {
  try {
    const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'genre', values: [genre] }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] }));
    const q3 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
    const q4 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [50] }));
    const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q1 + '&queries[]=' + q2 + '&queries[]=' + q3 + '&queries[]=' + q4, {
      headers: { 'X-Appwrite-Project': PROJECT },
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
  const featuredCandidates = articles.filter((a: any) => a.isGenreFeatured);
  const hero = featuredCandidates.length > 0 ? featuredCandidates[0] : articles[0];
  const pinned = articles.filter((a: any) => a.isGenrePinned && a.$id !== hero?.$id).slice(0, 3);
  const usedIds = new Set([hero?.$id, ...pinned.map((a: any) => a.$id)].filter(Boolean));
  const rest = articles.filter((a: any) => !usedIds.has(a.$id));
  return { hero, pinned, rest };
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const genre = unslugify(name);
  if (!genre) return { title: 'Not Found | Khabar Darjeeling' };
  const description = GENRE_DESCRIPTIONS[genre] || ('Latest ' + genre + ' news from Khabar Darjeeling.');
  return {
    title: genre + ' News | Khabar Darjeeling',
    description,
    alternates: { canonical: SITE + '/genre/' + name },
    openGraph: {
      title: genre + ' News | Khabar Darjeeling',
      description,
      url: SITE + '/genre/' + name,
      siteName: 'Khabar Darjeeling',
      type: 'website',
    },
  };
}

export default async function GenrePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const genre = unslugify(name);

  if (!genre) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>Genre not found</p>
        <Link href="/" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>Back to Home</Link>
      </div>
    );
  }

  const articles = await fetchGenreArticles(genre);
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
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>{genre}</h1>
        <p style={{ fontSize: '15px', color: 'var(--color-text-muted)', margin: '0 0 32px', maxWidth: '600px' }}>{GENRE_DESCRIPTIONS[genre]}</p>

        {articles.length === 0 ? (
          <div style={{ background: 'var(--color-surface)', borderRadius: '8px', padding: '60px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No {genre} stories yet - check back soon.
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
