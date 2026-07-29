import { NextResponse } from 'next/server';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = 'khabardarjeeling';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id') || searchParams.get('fileId');
  const bucket = searchParams.get('bucket') || 'article-image';

  if (!id) return new NextResponse('Missing id', { status: 400 });

  try {
    const url = ENDPOINT + '/storage/buckets/' + bucket + '/files/' + id + '/view?project=' + PROJECT;
    const res = await fetch(url);
    if (!res.ok) { const body = await res.text(); console.error('image-proxy failed:', res.status, url, body.substring(0, 300)); return new NextResponse('Not found', { status: 404 }); }
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
