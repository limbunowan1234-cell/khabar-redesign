import { NextRequest, NextResponse } from 'next/server';
import { saveDigest } from '@/lib/newsDigest';

const ADMIN_EMAIL = 'nowanad@gmail.com';

async function checkAdminJwt(jwt: string | null): Promise<boolean> {
  if (!jwt) return false;
  try {
    const res = await fetch('https://nyc.cloud.appwrite.io/v1/account', {
      headers: {
        'X-Appwrite-Project': 'khabardarjeeling',
        'X-Appwrite-JWT': jwt,
      },
    });
    if (!res.ok) return false;
    const user = await res.json();
    const labels = user.labels || [];
    return user.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
  } catch {
    return false;
  }
}

// Sections mirror app/admin/news-digest/page.tsx. Each query hits Google
// News' free public RSS search endpoint — no API key, no LLM call.
const SECTION_QUERIES: { title: string; query: string }[] = [
  { title: 'Weather & Landslides', query: 'Darjeeling landslide OR rain OR weather' },
  { title: 'Governance & Politics', query: 'GTA Darjeeling OR Gorkhaland politics' },
  { title: 'Civic & Infrastructure', query: 'Darjeeling hospital OR road OR infrastructure' },
  { title: 'Tourism', query: 'Darjeeling tourism' },
  { title: 'Tea & Economy', query: 'Darjeeling tea garden' },
  { title: 'Sports', query: 'Darjeeling football OR sports' },
];

const ITEMS_PER_SECTION = 3;
const MAX_AGE_DAYS = 10;

interface RssItem {
  title: string;
  pubDate: string;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripCdata(text: string): string {
  const match = text.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return decodeXmlEntities((match ? match[1] : text).trim());
}

function extractTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? stripCdata(match[1]) : '';
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const title = extractTag(block, 'title');
    const pubDate = extractTag(block, 'pubDate');
    if (title) items.push({ title, pubDate });
  }
  return items;
}

function splitHeadlineAndSource(rawTitle: string): { headline: string; source: string } {
  const idx = rawTitle.lastIndexOf(' - ');
  if (idx === -1) return { headline: rawTitle, source: 'Google News' };
  return { headline: rawTitle.slice(0, idx).trim(), source: rawTitle.slice(idx + 3).trim() };
}

function formatDateLabel(pubDate: string): string {
  const parsed = pubDate ? new Date(pubDate) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function fetchSection(title: string, query: string) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KhabarDigestBot/1.0)' },
    cache: 'no-store',
  });
  if (!res.ok) return { title, items: [] as ReturnType<typeof buildItem>[] };
  const xml = await res.text();
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const rssItems = parseRssItems(xml)
    .filter((item) => {
      const parsed = item.pubDate ? new Date(item.pubDate).getTime() : NaN;
      return !Number.isNaN(parsed) && parsed >= cutoff;
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, ITEMS_PER_SECTION);
  return { title, items: rssItems.map(buildItem) };
}

function buildItem(raw: RssItem) {
  const { headline, source } = splitHeadlineAndSource(raw.title);
  return {
    headline,
    summary: headline,
    source,
    dateLabel: formatDateLabel(raw.pubDate),
    badge: 'dated' as const,
  };
}

export async function POST(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const results = await Promise.allSettled(
      SECTION_QUERIES.map(({ title, query }) => fetchSection(title, query))
    );

    const sections = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchSection>>> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((section) => section.items.length > 0);

    if (sections.length === 0) {
      return NextResponse.json({ error: 'Could not fetch any live news right now. Try again shortly.' }, { status: 502 });
    }

    const lastVerified = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const payload = {
      sectionsJson: JSON.stringify(sections),
      lastVerified,
      updatedAt: new Date().toISOString(),
    };
    await saveDigest(payload);
    return NextResponse.json({ digest: payload });
  } catch (error) {
    console.error('news-digest refresh error:', error);
    return NextResponse.json({ error: 'Failed to refresh digest' }, { status: 500 });
  }
}
