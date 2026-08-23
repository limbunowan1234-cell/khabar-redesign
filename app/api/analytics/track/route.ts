import { NextRequest, NextResponse } from 'next/server';
import { recordEvent } from '@/lib/analyticsEvents';
import { randomUUID } from 'node:crypto';

// Public endpoint: any visitor (logged in or not) can report a page view.
// Writes go through the service API key (see lib/analyticsEvents.ts) rather
// than granting the analytics_events collection public write access, so
// this route is the only path that can create events.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Shadow-writes into D1 alongside the real Appwrite write above (which
// stays authoritative). Fire-and-forget: a D1 failure here must never
// surface to the reader. No auth needed -- this data was already public,
// unauthenticated telemetry on the Appwrite side (see the comment above).
async function shadowWriteEvent(id: string, event: Record<string, unknown>) {
  try {
    await fetch(`${WORKER_URL}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...event }),
    });
  } catch {}
}

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

    await recordEvent(event, id);
    shadowWriteEvent(id, event);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('analytics track error:', error);
    // Never let analytics failures surface to the reader.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
