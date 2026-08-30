import { NextRequest, NextResponse } from 'next/server';

// Admin-only: the finalized winners WITH mailing address/phone, so the
// admin panel can actually address and send each memento.
//
// JWT-based admin check (X-Appwrite-JWT) -- see the comment on
// finalize-winners/route.ts's checkAdminJwt for why this replaced the
// cookie-forwarding pattern (it was silently failing: the incoming
// request's `cookie` header never carries the Appwrite session cookie,
// which is scoped to a different domain).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SERVICE_HEADERS = { 'X-Service-Secret': process.env.WORKER_SERVICE_SECRET || '' };

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
    return user.email?.toLowerCase() === ADMIN_EMAIL || (user.labels || []).includes('admin');
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-admin-jwt');
    const isAdmin = await checkAdminJwt(jwt);
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
