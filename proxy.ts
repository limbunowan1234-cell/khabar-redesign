import { NextResponse, type NextRequest } from 'next/server';

// /region/Darjeeling, /genre/Voice%20of%20People and similar old or hand-typed
// links: 308 to the lowercase, hyphenated slug the pages are built under
// (same rule as slugify() in app/region and app/genre). Done here rather than
// in the page so the redirect isn't stored in the ISR cache.
export function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/(region|genre)\/([^/]+)\/?$/);
  if (!match) return NextResponse.next();
  const [, section, raw] = match;
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch {}
  const slug = decoded.trim().toLowerCase().replace(/\s+/g, '-');
  if (slug === decoded) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/' + section + '/' + encodeURIComponent(slug);
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: ['/region/:path*', '/genre/:path*'],
};
