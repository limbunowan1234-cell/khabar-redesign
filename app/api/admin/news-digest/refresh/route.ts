import { NextRequest, NextResponse } from 'next/server';

const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Week 30 of the Cloudflare migration (see cloudflare/README.md): writes
// D1 directly now -- see the matching comment in ../route.ts.

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

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const TAVILY_TIMEOUT_MS = 30000;

// Sections mirror app/admin/news-digest/page.tsx.
const SECTION_QUERIES: { title: string; query: string }[] = [
  { title: 'Weather & Landslides', query: 'Darjeeling landslide rain weather monsoon' },
  { title: 'Governance & Politics', query: 'GTA Gorkhaland Darjeeling politics civic administration' },
  { title: 'Civic & Infrastructure', query: 'Darjeeling hospital road infrastructure project' },
  { title: 'Tourism', query: 'Darjeeling tourism' },
  { title: 'Tea & Economy', query: 'Darjeeling tea garden economy' },
  { title: 'Sports', query: 'Darjeeling football sports' },
];

const ITEMS_PER_SECTION = 3;
const MAX_AGE_DAYS = 10;
// Tavily's own `days` filter isn't strictly enforced server-side (we saw a
// 3-week-old result come back with days:10), so freshness is re-checked
// client-side below. This score floor just drops the weakest matches.
const MIN_SCORE = 0.25;
const FETCH_PER_SECTION = 6; // over-fetch so filtering still leaves ITEMS_PER_SECTION

type Badge = 'dated' | 'watch';

interface DigestItem {
  headline: string;
  summary: string;
  source: string;
  dateLabel: string;
  badge: Badge;
}

interface DigestSection {
  title: string;
  items: DigestItem[];
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date: string | null;
}

// Tavily's `content` field concatenates several extracted chunks joined by
// "[...]"; the first chunk is almost always the clean lead paragraph, with
// later chunks being nav/related-links noise pulled from elsewhere on the
// page. Take just the first chunk and tidy whitespace.
function cleanSummary(content: string): string {
  const firstChunk = (content.split('[...]')[0] || '').trim();
  const collapsed = firstChunk.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const MAX_LEN = 400;
  if (collapsed.length <= MAX_LEN) return collapsed;
  const truncated = collapsed.slice(0, MAX_LEN);
  const lastPeriod = truncated.lastIndexOf('. ');
  return lastPeriod > 100 ? truncated.slice(0, lastPeriod + 1) : truncated.trim() + '…';
}

function sourceFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown source';
  }
}

// Relative labels ("2 hours ago") are computed once, at refresh time, and
// stored as a plain string — so they're accurate as of the refresh and
// will read a little behind by the time of the *next* refresh, same as
// every other dateLabel here. Anything past 24h just gets the absolute date.
function formatDateLabel(dateStr: string | null): { dateLabel: string; badge: Badge; timestamp: number | null } {
  if (!dateStr) return { dateLabel: 'Recent', badge: 'watch', timestamp: null };
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return { dateLabel: 'Recent', badge: 'watch', timestamp: null };
  const timestamp = parsed.getTime();
  const diffMs = Date.now() - timestamp;

  if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) {
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    let dateLabel: string;
    if (diffMins < 1) dateLabel = 'Just now';
    else if (diffMins < 60) dateLabel = `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    else dateLabel = `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return { dateLabel, badge: 'dated', timestamp };
  }

  return {
    dateLabel: parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    badge: 'dated',
    timestamp,
  };
}

function toDigestItem(raw: TavilyResult): (DigestItem & { timestamp: number | null }) | null {
  if (!raw.title?.trim() || !raw.content?.trim()) return null;
  const summary = cleanSummary(raw.content);
  if (!summary) return null;
  const { dateLabel, badge, timestamp } = formatDateLabel(raw.published_date);

  // A result WITH a specific date that's stale gets dropped (this is
  // supposed to be the latest news). A result with no date at all is kept
  // and treated as an ongoing/evergreen "watch" item, same as before.
  if (timestamp !== null) {
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    if (timestamp < cutoff) return null;
  }

  return {
    headline: raw.title.trim(),
    summary,
    source: sourceFromUrl(raw.url),
    dateLabel,
    badge,
    timestamp,
  };
}

async function fetchSection(title: string, query: string, apiKey: string): Promise<DigestSection> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TAVILY_TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        topic: 'news',
        search_depth: 'advanced',
        days: MAX_AGE_DAYS,
        max_results: FETCH_PER_SECTION,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`news-digest: Tavily call failed for "${title}" (${res.status}): ${body.slice(0, 500)}`);
      return { title, items: [] };
    }

    const data = await res.json();
    const results: TavilyResult[] = Array.isArray(data?.results) ? data.results : [];

    const items = results
      .filter((r) => (r.score ?? 0) >= MIN_SCORE)
      .map(toDigestItem)
      .filter((item): item is DigestItem & { timestamp: number | null } => item !== null)
      .sort((a, b) => (b.timestamp ?? -Infinity) - (a.timestamp ?? -Infinity))
      .slice(0, ITEMS_PER_SECTION)
      .map(({ timestamp: _timestamp, ...item }) => item);

    return { title, items };
  } catch (error) {
    console.error(`news-digest: error fetching section "${title}":`, error);
    return { title, items: [] };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error('news-digest refresh error: TAVILY_API_KEY is not set');
    return NextResponse.json({ error: 'Server is missing TAVILY_API_KEY.' }, { status: 500 });
  }

  try {
    const results = await Promise.allSettled(
      SECTION_QUERIES.map(({ title, query }) => fetchSection(title, query, apiKey))
    );

    const sections = results
      .filter((r): r is PromiseFulfilledResult<DigestSection> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((section) => section.items.length > 0);

    if (sections.length === 0) {
      return NextResponse.json({ error: 'Tavily could not find any live news right now. Try again shortly.' }, { status: 502 });
    }

    const lastVerified = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const payload = {
      sectionsJson: JSON.stringify(sections),
      lastVerified,
      updatedAt: new Date().toISOString(),
    };
    const res = await fetch(`${WORKER_URL}/news-digest`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jwt!, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Worker write failed: ' + res.status);
    return NextResponse.json({ digest: payload });
  } catch (error) {
    console.error('news-digest refresh error:', error);
    return NextResponse.json({ error: 'Failed to refresh digest' }, { status: 500 });
  }
}
