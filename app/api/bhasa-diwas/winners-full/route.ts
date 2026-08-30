import { NextRequest, NextResponse } from 'next/server';

// Admin-only: the finalized winners WITH mailing address/phone, so the
// admin panel can actually address and send each memento. Same
// admin-cookie-check-then-proxy pattern as admin-feature/route.ts.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SERVICE_HEADERS = { 'X-Service-Secret': process.env.WORKER_SERVICE_SECRET || '' };

const ADMIN_EMAIL = 'nowanad@gmail.com';

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const cookieHeader = req.headers.get('cookie') || '';
  try {
    const res = await fetch('https://nyc.cloud.appwrite.io/v1/account', {
      headers: {
        'X-Appwrite-Project': 'khabardarjeeling',
        'cookie': cookieHeader
      }
    });
    if (!res.ok) return false;
    const user = await res.json();
    return user.email?.toLowerCase() === ADMIN_EMAIL || (user.labels || []).includes('admin');
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await checkAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const res = await fetch(WORKER_URL + '/bhasa-diwas/winners/full', { headers: SERVICE_HEADERS });
    if (!res.ok) throw new Error('Worker read failed');
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Winners-full fetch error:', error);
    return NextResponse.json({ documents: [] }, { status: 500 });
  }
}
