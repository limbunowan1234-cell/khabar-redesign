import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

// Week 32 of the Cloudflare migration (see cloudflare/README.md):
// analytics_events retention used to ride along on this cron (Vercel's
// Hobby plan caps cron jobs at 2, so there was never a slot for its
// own) -- moved to a native Cloudflare Cron Trigger instead
// (cloudflare/wrangler.toml's [triggers], see the scheduled() handler
// in cloudflare/src/index.ts), since the write itself moved to D1 too.
//
// Week 35: the weekly-picks publish that used to run here on Sundays
// (and, redundantly, in its own now-deleted app/api/publish-weekly
// route on the same schedule) moved the same way, for the same reason
// -- articles is D1-only as of Week 34, so writing weeklyLive to
// Appwrite here isn't valid anymore.

export async function GET() {
  try {
    revalidatePath('/sitemap.ts');
    revalidatePath('/news-sitemap.xml');

    console.log('Sitemaps revalidated at', new Date().toISOString());
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}
