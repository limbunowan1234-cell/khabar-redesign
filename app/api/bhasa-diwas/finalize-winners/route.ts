import { NextRequest, NextResponse } from 'next/server';

// Admin action: ranks the top 3 (by votes) in poetry and essay and marks
// them as winners, so their submitter can then see the "you won" banner
// and submit an address for the memento. Same admin-cookie-check-then-
// proxy-to-Worker pattern as admin-feature/route.ts in this same folder.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SERVICE_HEADERS = { 'X-Service-Secret': process.env.WORKER_SERVICE_SECRET || '', 'Content-Type': 'application/json' };

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

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await checkAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const res = await fetch(WORKER_URL + '/bhasa-diwas/finalize-winners', {
      method: 'POST',
      headers: SERVICE_HEADERS,
    });
    if (!res.ok) throw new Error('Worker write failed');
    const data = await res.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Finalize winners error:', error);
    return NextResponse.json({ error: 'Failed to finalize winners' }, { status: 500 });
  }
}
