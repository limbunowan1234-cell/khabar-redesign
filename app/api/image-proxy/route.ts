import { NextResponse } from 'next/server';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new NextResponse('Missing id', { status: 400 });

  try {
    const url = ENDPOINT + '/storage/buckets/article-image/files/' + id + '/view?project=' + PROJECT;
    const res = await fetch(url);
    if (!res.ok) return new NextResponse('Not found', { status: 404 });
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    return new NextResponse('Error', { status: 500 });
  }
}
