import { NextResponse } from 'next/server';

// Public: the finalized top-3 poetry/essay winners, no address/phone
// (see toSubmissionJson in cloudflare/src/routes/bhasaDiwas.ts). Used by
// the public results page and by a submitter's own "did I win?" banner.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export async function GET() {
  try {
    const res = await fetch(WORKER_URL + '/bhasa-diwas/winners');
    if (!res.ok) throw new Error('Worker read failed');
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Winners fetch error:', error);
    return NextResponse.json({ documents: [] }, { status: 500 });
  }
}
