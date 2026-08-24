import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// Week 32 of the Cloudflare migration (see cloudflare/README.md):
// analytics_events retention used to ride along on this cron (Vercel's
// Hobby plan caps cron jobs at 2, so there was never a slot for its
// own) -- moved to a native Cloudflare Cron Trigger instead
// (cloudflare/wrangler.toml's [triggers], see the scheduled() handler
// in cloudflare/src/index.ts), since the write itself moved to D1 too.
const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };

async function publishWeeklyIfSunday() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const isSunday = istNow.getUTCDay() === 0;
  if (!isSunday) return { published: false, reason: 'not sunday' };

  try {
    const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'isWeeklyPick', values: [true] }));
    const q2 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'weeklyLive', values: [false] }));
    const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + q + '&queries[]=' + q2, { headers: H });
    if (!res.ok) return { published: false, reason: 'fetch failed' };
    const data = await res.json();
    const picks = data.documents || [];
    for (const a of picks) {
      await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents/' + a.$id, {
        method: 'PATCH', headers: H,
        body: JSON.stringify({ data: { weeklyLive: true } })
      });
    }
    return { published: true, count: picks.length };
  } catch (e) {
    return { published: false, reason: 'error' };
  }
}

export async function GET(req: Request) {
  try {
    revalidatePath('/sitemap.ts');
    revalidatePath('/news-sitemap.xml');

    const weekly = await publishWeeklyIfSunday();

    console.log('Sitemaps revalidated at', new Date().toISOString());
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), weekly });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}
