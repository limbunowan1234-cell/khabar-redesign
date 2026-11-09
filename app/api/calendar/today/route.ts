import { NextResponse } from 'next/server';
import { todayPayload } from '@/lib/patro/today';

// Tiny JSON for the home page "Today" card, so the 100 KB year files never reach the client bundle.
// The IST date flips at midnight, so the CDN copy is kept short.
export async function GET() {
  const payload = todayPayload();
  if (!payload) {
    return NextResponse.json({ error: 'No calendar data for today' }, { status: 404, headers: { 'Cache-Control': 'public, s-maxage=300' } });
  }
  return NextResponse.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
