import { NextRequest, NextResponse } from 'next/server';

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

const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Week 29 of the Cloudflare migration (see cloudflare/README.md): writes
// to D1 directly now -- Appwrite's contest_settings/main document is
// frozen as of this cutover. Reuses the same admin JWT already verified
// above -- the Worker checks it independently.
export async function POST(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const live = !!body.live;
    const res = await fetch(`${WORKER_URL}/contest/settings`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jwt!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ certificatesLive: live }),
    });
    if (!res.ok) throw new Error('Worker write failed: ' + res.status);
    return NextResponse.json({ success: true, certificatesLive: live });
  } catch (error) {
    console.error('publish-certificates error:', error);
    return NextResponse.json({ error: 'Failed to update publish status' }, { status: 500 });
  }
}
