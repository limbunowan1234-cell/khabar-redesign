import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { deleteEventsOlderThan } from '@/lib/analyticsEvents';

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

    // Vercel's Hobby plan caps cron jobs at 2 (already used by this route
    // and publish-weekly), so daily analytics_events retention rides along
    // on this existing daily cron instead of registering a third one.
    let analyticsCleanup: { deleted: number } | { error: string };
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const deleted = await deleteEventsOlderThan(cutoff);
      analyticsCleanup = { deleted };
    } catch (e) {
      console.error('analytics cleanup (via revalidate-sitemaps) error:', e);
      analyticsCleanup = { error: 'failed' };
    }

    console.log('Sitemaps revalidated at', new Date().toISOString());
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), weekly, analyticsCleanup });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}
