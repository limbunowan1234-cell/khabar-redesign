import { NextRequest, NextResponse } from 'next/server';
import { checkAdminJwt } from '@/lib/serverAuth';

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
