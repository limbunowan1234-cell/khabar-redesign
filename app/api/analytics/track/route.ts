import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

// Week 32 of the Cloudflare migration (see cloudflare/README.md): writes
// to D1 directly now, not Appwrite. Appwrite never actually worked here
// in production -- the service API key was missing the
// collections.write scope needed to auto-create analytics_events, so
// every single write had been failing since at least 2026-08-17 (found
// via Vercel runtime error logs). Since the Appwrite write was awaited
// before the D1 shadow-write, that failure was silently blocking the
// shadow-write too -- D1 had zero rows this whole time. This wasn't a
// migration decision so much as fixing a completely dead production
// feature by finishing the cutover that should have made it resilient
// in the first place.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId.slice(0, 128) : '';
    if (!visitorId) {
      return NextResponse.json({ error: 'visitorId is required' }, { status: 400 });
    }
    const eventType = ['view', 'comment', 'like'].includes(body.eventType) ? body.eventType : 'view';

    const id = randomUUID();
    const event = {
      visitorId,
      userId: typeof body.userId === 'string' ? body.userId.slice(0, 128) : null,
      eventType,
      articleId: typeof body.articleId === 'string' ? body.articleId.slice(0, 128) : null,
      // Geo tracking isn't built yet — always null for now, per scope.
      userCountry: null,
      timestamp: new Date().toISOString(),
    };

    await fetch(`${WORKER_URL}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...event }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('analytics track error:', error);
    // Never let analytics failures surface to the reader.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
