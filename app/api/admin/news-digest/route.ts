import { NextRequest, NextResponse } from 'next/server';
import { getDigest, saveDigest } from '@/lib/newsDigest';

const ADMIN_EMAIL = 'nowanad@gmail.com';

async function checkAdminJwt(jwt: string | null): Promise<boolean> {
  if (!jwt) return false;
  try {
    const res = await fetch('https://nyc.cloud.appwrite.io/v1/account', {
      headers: {
        'X-Appwrite-Project': 'khabardarjeeling',
        'X-Appwrite-JWT': jwt,
      },
    });
    if (!res.ok) return false;
    const user = await res.json();
    const labels = user.labels || [];
    return user.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
  } catch {
    return false;
  }
}

function checkCronSecret(req: NextRequest): boolean {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return !!process.env.NEWS_DIGEST_CRON_SECRET && token === process.env.NEWS_DIGEST_CRON_SECRET;
}

export async function GET(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  const isCron = checkCronSecret(req);
  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const digest = await getDigest();
  if (!digest) {
    return NextResponse.json({ digest: null });
  }
  return NextResponse.json({ digest });
}

export async function POST(req: NextRequest) {
  const isCron = checkCronSecret(req);
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = isCron ? true : await checkAdminJwt(jwt);
  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { sections, lastVerified } = body;
    if (!sections || !Array.isArray(sections)) {
      return NextResponse.json({ error: 'sections array is required' }, { status: 400 });
    }
    await saveDigest({
      sectionsJson: JSON.stringify(sections),
      lastVerified: lastVerified || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('news-digest save error:', error);
    return NextResponse.json({ error: 'Failed to save digest' }, { status: 500 });
  }
}
