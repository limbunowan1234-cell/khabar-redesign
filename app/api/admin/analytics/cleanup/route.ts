import { NextRequest, NextResponse } from 'next/server';
import { deleteEventsOlderThan } from '@/lib/analyticsEvents';

// Vercel cron only (see vercel.json) — deletes raw analytics_events older
// than 30 days, per the "don't store raw page views forever" requirement.
// Reuses the same CRON_SECRET convention as app/api/publish-weekly/route.ts
// (Vercel auto-injects `Authorization: Bearer $CRON_SECRET` for any path
// registered in vercel.json's crons array once that env var is set).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const deleted = await deleteEventsOlderThan(cutoff);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('analytics cleanup error:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
