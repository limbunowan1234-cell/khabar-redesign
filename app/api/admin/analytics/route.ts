import { NextRequest, NextResponse } from 'next/server';

const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

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

async function fetchEventsSince(sinceIso: string): Promise<any[]> {
  const res = await fetch(`${WORKER_URL}/analytics/events?since=${encodeURIComponent(sinceIso)}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

async function fetchAllArticles(): Promise<any[]> {
  const res = await fetch(`${WORKER_URL}/articles?limit=1000`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

function dayKeyUTC(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD, fine for both $createdAt and our own ISO timestamps
}

export async function GET(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

    const [events, articles] = await Promise.all([
      fetchEventsSince(thirtyDaysAgoIso).catch((err) => {
        console.error('analytics: failed to load events', err);
        return [] as any[];
      }),
      fetchAllArticles(),
    ]);

    const viewEvents = events.filter((e) => e.eventType === 'view' && e.visitorId);

    // MAU / DAU: unique visitor ids, not Appwrite user ids — most readers
    // aren't logged in, so this reflects actual traffic instead of just
    // authenticated accounts.
    const mauSet = new Set(viewEvents.map((e) => e.visitorId));
    const dauSet = new Set(viewEvents.filter((e) => dayKeyUTC(e.timestamp) === todayKey).map((e) => e.visitorId));

    // Avg session time: group each visitor's views by calendar day and use
    // the span between their first and last view that day as a proxy for
    // session length (we only ping once per page view, not a heartbeat).
    // Single-view "sessions" get a 1-minute floor rather than 0, and spans
    // are capped at 30 minutes so an abandoned tab doesn't skew the average.
    const sessionKeyMap = new Map<string, number[]>();
    for (const e of viewEvents) {
      const key = e.visitorId + '|' + dayKeyUTC(e.timestamp);
      const ts = new Date(e.timestamp).getTime();
      if (!sessionKeyMap.has(key)) sessionKeyMap.set(key, []);
      sessionKeyMap.get(key)!.push(ts);
    }
    let totalSessionMinutes = 0;
    let sessionCount = 0;
    for (const timestamps of sessionKeyMap.values()) {
      timestamps.sort((a, b) => a - b);
      const spanMinutes = (timestamps[timestamps.length - 1] - timestamps[0]) / 60000;
      totalSessionMinutes += Math.min(Math.max(spanMinutes, 1), 30);
      sessionCount += 1;
    }
    const avgSessionMinutes = sessionCount > 0 ? totalSessionMinutes / sessionCount : 0;

    // 7-day traffic trend: unique visitors per day.
    const trend: { date: string; uniqueUsers: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const uniqueUsers = new Set(viewEvents.filter((e) => dayKeyUTC(e.timestamp) === key).map((e) => e.visitorId)).size;
      trend.push({ date: key, uniqueUsers });
    }

    // Top 5 articles this month, ranked by tracked view events in the last
    // 30 days (not the lifetime `views` counter on the article document,
    // which isn't time-bounded). This will be sparse until events
    // accumulate post-deploy since there's no historical backfill.
    const viewsByArticle = new Map<string, number>();
    for (const e of viewEvents) {
      if (!e.articleId) continue;
      viewsByArticle.set(e.articleId, (viewsByArticle.get(e.articleId) || 0) + 1);
    }
    const articleById = new Map(articles.map((a) => [a.$id, a]));
    const topArticles = Array.from(viewsByArticle.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([articleId, viewsThisMonth]) => {
        const a = articleById.get(articleId);
        return {
          articleId,
          title: a?.title || '(deleted article)',
          author: a?.submitterName || a?.authorName || 'Unknown',
          viewsThisMonth,
          lifetimeViews: a?.views || 0,
        };
      });

    // Articles & contributors.
    const totalArticles = articles.length;
    const articlesThisMonth = articles.filter((a) => {
      const dateStr = a.publishedAt || a.$createdAt;
      return dateStr && new Date(dateStr).getTime() >= thirtyDaysAgo.getTime();
    }).length;

    const contributorKey = (a: any) => a.submitterId || a.submitterName || a.authorName || 'unknown';
    const totalContributors = new Set(articles.map(contributorKey)).size;
    const activeContributorsThisMonth = new Set(
      articles
        .filter((a) => {
          const dateStr = a.publishedAt || a.$createdAt;
          return dateStr && new Date(dateStr).getTime() >= thirtyDaysAgo.getTime();
        })
        .map(contributorKey)
    ).size;

    return NextResponse.json({
      mau: mauSet.size,
      dau: dauSet.size,
      avgSessionMinutes: Math.round(avgSessionMinutes * 10) / 10,
      totalArticles,
      articlesThisMonth,
      totalContributors,
      activeContributorsThisMonth,
      // Geo tracking isn't built yet (deliberately out of scope for now) —
      // these are fixed category labels, not measured data.
      geoSplit: [
        { label: 'India', note: 'Not yet tracked' },
        { label: 'Diaspora', note: 'Not yet tracked' },
        { label: 'Other', note: 'Not yet tracked' },
      ],
      topArticles,
      trend,
      trackedEventCount: events.length,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('admin analytics error:', error);
    return NextResponse.json({ error: 'Failed to compute analytics' }, { status: 500 });
  }
}
