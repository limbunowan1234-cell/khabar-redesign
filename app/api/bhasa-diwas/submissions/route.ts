import { NextRequest, NextResponse } from 'next/server';

// Week 11 of the Cloudflare migration (see cloudflare/README.md): reads
// come from the Worker. Voting/commenting/submitting stay on Appwrite.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get('category');
    const userId = searchParams.get('userId');

    const res = await fetch(WORKER_URL + '/bhasa-diwas/submissions?category=' + encodeURIComponent(category || 'all'));
    const data = res.ok ? await res.json() : { documents: [], total: 0 };

    let userVotes: string[] = [];
    if (userId) {
      const votesRes = await fetch(WORKER_URL + '/bhasa-diwas/votes?voterId=' + encodeURIComponent(userId));
      if (votesRes.ok) userVotes = (await votesRes.json()).submissionIds || [];
    }

    return NextResponse.json({
      submissions: data.documents || [],
      userVotes,
      total: data.total || 0
    });
  } catch (error) {
    console.error('Submissions fetch error:', error);
    return NextResponse.json(
      { error: 'सबमिशन लोड असफल' },
      { status: 500 }
    );
  }
}