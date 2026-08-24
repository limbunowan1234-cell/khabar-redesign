import { NextRequest, NextResponse } from 'next/server';

const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Week 30 of the Cloudflare migration (see cloudflare/README.md): reads
// and writes D1 directly now -- Appwrite's news_digest/main document is
// frozen as of this cutover. Dropped the cron-secret path entirely: it
// was never wired to an actual Vercel cron (not in vercel.json's crons
// array, confirmed via grep -- no other caller anywhere), so it was
// dead capability rather than a real path to preserve a fallback for.

async function fetchDigestFromWorker(jwt: string) {
  try {
    const res = await fetch(`${WORKER_URL}/news-digest`, { headers: { Authorization: 'Bearer ' + jwt }, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.digest;
  } catch {
    return null;
  }
}

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

export async function GET(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const digest = await fetchDigestFromWorker(jwt!);
  return NextResponse.json({ digest });
}

export async function POST(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { sections, lastVerified } = body;
    if (!sections || !Array.isArray(sections)) {
      return NextResponse.json({ error: 'sections array is required' }, { status: 400 });
    }
    const payload = {
      sectionsJson: JSON.stringify(sections),
      lastVerified: lastVerified || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const res = await fetch(`${WORKER_URL}/news-digest`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jwt!, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Worker write failed: ' + res.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('news-digest save error:', error);
    return NextResponse.json({ error: 'Failed to save digest' }, { status: 500 });
  }
}
