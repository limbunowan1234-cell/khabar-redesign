import { NextRequest, NextResponse } from 'next/server';

// Admin action: ranks the top 3 (by votes) in poetry and essay and marks
// them as winners, so their submitter can then see the "you won" banner
// and submit an address for the memento.
//
// Admin check is JWT-based (X-Appwrite-JWT), matching
// app/api/admin/contest/publish-certificates/route.ts -- NOT the
// cookie-forwarding pattern admin-feature/route.ts uses. That pattern
// reads the *incoming* request's `cookie` header and re-sends it to
// Appwrite, but the browser only attaches cookies scoped to this
// request's own domain (khabardarjeeling.in); the real Appwrite session
// cookie is scoped to api.khabardarjeeling.in, a different origin, so it
// was never present to forward in the first place -- confirmed live
// (every call landed a 403, checkAdmin silently returning false). A JWT
// minted client-side via lib/appwrite.ts's getWorkerAuthToken() and sent
// as a plain header sidesteps that entirely.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SERVICE_HEADERS = { 'X-Service-Secret': process.env.WORKER_SERVICE_SECRET || '', 'Content-Type': 'application/json' };

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

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-admin-jwt');
    const isAdmin = await checkAdminJwt(jwt);
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
