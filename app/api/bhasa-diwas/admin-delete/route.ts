import { NextRequest, NextResponse } from 'next/server';

// Week 38 of the Cloudflare migration (see cloudflare/README.md): the
// delete moves to D1. Admin identity is still verified against Appwrite
// (auth stays there permanently) via the forwarded session cookie,
// exactly as before -- only the database write moved.
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

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const res = await fetch(WORKER_URL + '/bhasa-diwas/submissions/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: SERVICE_HEADERS,
    });
    if (!res.ok) throw new Error('Worker delete failed');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}