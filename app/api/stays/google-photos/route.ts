import { NextRequest, NextResponse } from 'next/server';
import { STAYS } from '@/lib/stays';

// Google Places photos for a listed stay, fetched only when a reader taps "See photos on Google".
// Server-side so GOOGLE_PLACES_API_KEY never reaches the browser, and limited to stays in
// data/stays.json so the route can't be used to look up arbitrary places on our bill.
//
// Google's terms forbid caching photos or photo names (only place IDs may be stored), so every
// call goes to Google and nothing here is cached. Each call costs one Place Details (Photos) request
// plus one Place Photo request per photo; the Text Search fallback for stays without a stored
// googlePlaceId is the free IDs-only SKU. Cap the key's daily quota in Google Cloud.

const API = 'https://places.googleapis.com/v1';
const MAX_PHOTOS = 3;

interface Author { displayName?: string; uri?: string }

async function places(path: string, key: string, init: RequestInit & { fieldMask?: string } = {}) {
  const { fieldMask, headers, ...rest } = init;
  return fetch(API + path, {
    ...rest,
    cache: 'no-store',
    headers: { 'X-Goog-Api-Key': key, ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}), ...headers },
  });
}

export async function GET(req: NextRequest) {
  const stay = STAYS.find((s) => s.id === req.nextUrl.searchParams.get('stay'));
  if (!stay) return NextResponse.json({ error: 'Unknown stay' }, { status: 404 });

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    console.error('stays/google-photos: GOOGLE_PLACES_API_KEY is not set');
    return NextResponse.json({ error: 'Photos are not available right now' }, { status: 503 });
  }

  try {
    let placeId = stay.googlePlaceId;
    if (!placeId) {
      const res = await places('/places:searchText', key, {
        method: 'POST',
        fieldMask: 'places.id',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textQuery: `${stay.name}, ${stay.area}`, maxResultCount: 1 }),
      });
      placeId = res.ok ? (await res.json()).places?.[0]?.id : undefined;
      if (!placeId) return NextResponse.json({ error: 'Not found on Google Maps' }, { status: 404 });
    }

    const details = await places('/places/' + encodeURIComponent(placeId), key, { fieldMask: 'photos' });
    if (!details.ok) throw new Error('Place Details ' + details.status);
    const found: { name: string; widthPx: number; heightPx: number; authorAttributions?: Author[] }[] = (await details.json()).photos || [];

    const photos = (
      await Promise.all(
        found.slice(0, MAX_PHOTOS).map(async (p) => {
          const media = await places(`/${p.name}/media?maxWidthPx=1200&skipHttpRedirect=true`, key);
          if (!media.ok) return null;
          const { photoUri } = await media.json();
          return {
            url: photoUri as string,
            width: p.widthPx,
            height: p.heightPx,
            authors: (p.authorAttributions || []).map((a) => ({ name: a.displayName || 'A Google Maps user', uri: a.uri || null })),
          };
        })
      )
    ).filter(Boolean);

    return NextResponse.json(
      {
        photos,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stay.name)}&query_place_id=${encodeURIComponent(placeId)}`,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('stays/google-photos:', err);
    return NextResponse.json({ error: 'Could not load photos from Google' }, { status: 502 });
  }
}
