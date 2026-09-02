import { NextRequest, NextResponse } from 'next/server';

// Public proxy, same trust level as app/api/analytics/track/route.ts --
// the Worker itself only records an event if the campaign is active in
// D1, so a stray/forged call against an inactive or nonexistent
// campaign is a no-op either way.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.campaignId || !body.placementId || !body.eventType) {
      return NextResponse.json({ error: 'campaignId, placementId, and eventType are required' }, { status: 400 });
    }

    await fetch(`${WORKER_URL}/ads/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: String(body.campaignId).slice(0, 128),
        placementId: String(body.placementId).slice(0, 128),
        eventType: body.eventType,
        deviceType: typeof body.deviceType === 'string' ? body.deviceType.slice(0, 32) : null,
        visitorId: typeof body.visitorId === 'string' ? body.visitorId.slice(0, 128) : null,
        pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 512) : null,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ad track error:', error);
    // Never let ad tracking failures surface to the reader.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
