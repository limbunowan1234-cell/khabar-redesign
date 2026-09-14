import { NextRequest, NextResponse } from 'next/server';
import { checkAdminJwt } from '@/lib/serverAuth';

// Week 38 of the Cloudflare migration (see cloudflare/README.md): the
// isFeatured write moves to D1. Admin identity used to be checked via a
// forwarded session cookie -- that pattern never actually worked (the
// incoming request's cookie header never carried the session cookie,
// scoped to a different domain; see finalize-winners/route.ts's own
// history of the same bug) and the outage that took Appwrite auth down
// entirely made it moot either way. Now uses the same x-admin-jwt header
// pattern as every other admin route (see lib/serverAuth.ts).
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SERVICE_HEADERS = { 'X-Service-Secret': process.env.WORKER_SERVICE_SECRET || '', 'Content-Type': 'application/json' };

export async function POST(req: NextRequest) {
  try {
    const jwt = req.headers.get('x-admin-jwt');
    const isAdmin = await checkAdminJwt(jwt);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { id, isFeatured } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const res = await fetch(WORKER_URL + '/bhasa-diwas/submissions/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: SERVICE_HEADERS,
      body: JSON.stringify({ isFeatured: !!isFeatured }),
    });
    if (!res.ok) throw new Error('Worker write failed');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin feature toggle error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
