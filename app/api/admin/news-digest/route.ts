import { NextRequest, NextResponse } from 'next/server';
import { getDigest, saveDigest } from '@/lib/newsDigest';

const ADMIN_EMAIL = 'nowanad@gmail.com';
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Shadow-write into D1, alongside the real Appwrite write (which stays
// authoritative). Fire-and-forget: a D1 failure must never surface to
// the admin or block the real save. Reuses the same admin JWT already
// verified above -- the Worker checks it independently. Only reachable
// from the interactive admin-JWT path; the cron-secret path (see
// checkCronSecret below) has no JWT to reuse, so it stays Appwrite-only
// -- documented in cloudflare/README.md.
async function shadowWriteDigest(jwt: string, body: { sectionsJson: string; lastVerified: string; updatedAt: string }) {
  try {
    await fetch(`${WORKER_URL}/news-digest`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {}
}

async function fetchDigestFromWorker(jwt: string) {
  try {
    const res = await fetch(`${WORKER_URL}/news-digest`, { headers: { Authorization: 'Bearer ' + jwt }, cache: 'no-store' });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.digest;
  } catch {
    return undefined;
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
  // The cron path has no per-admin JWT to present to the Worker, so it
  // reads Appwrite directly, same as before this migration.
  const digest = (isAdmin && jwt ? await fetchDigestFromWorker(jwt) : undefined) ?? (await getDigest());
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
    const payload = {
      sectionsJson: JSON.stringify(sections),
      lastVerified: lastVerified || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveDigest(payload);
    if (jwt) shadowWriteDigest(jwt, payload);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('news-digest save error:', error);
    return NextResponse.json({ error: 'Failed to save digest' }, { status: 500 });
  }
}
