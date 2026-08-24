import { NextRequest, NextResponse } from 'next/server';

// Week 11 of the Cloudflare migration (see cloudflare/README.md): the
// leaderboard read comes from the Worker. Week 38: casting a vote does
// too -- the Worker enforces one-vote-per-submission with a real UNIQUE
// constraint (INSERT ... ON CONFLICT DO NOTHING), atomically, rather than
// this route's old check-then-create race against Appwrite.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SERVICE_HEADERS = { 'X-Service-Secret': process.env.WORKER_SERVICE_SECRET || '', 'Content-Type': 'application/json' };

export async function POST(req: NextRequest) {
  try {
    const { submissionId, userId } = await req.json();

    if (!submissionId || !userId) {
      return NextResponse.json(
        { error: 'सबमिशन र प्रयोगकर्ता आइडी आवश्यक छ' },
        { status: 400 }
      );
    }

    const res = await fetch(WORKER_URL + '/bhasa-diwas/votes', {
      method: 'POST',
      headers: SERVICE_HEADERS,
      body: JSON.stringify({ submissionId, voterId: userId }),
    });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data.error === 'Already voted' ? 'तपाइँ पहिले नै यस रचनामा मत दिइसक्नुभएको छ' : 'मत दिन असफल' },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { error: 'मत दिन असफल' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const result: any = {};

    for (const category of ['poetry', 'essay', 'photo']) {
      const res = await fetch(WORKER_URL + '/bhasa-diwas/submissions?category=' + category + '&sort=votes&limit=5');
      const data = res.ok ? await res.json() : { documents: [], total: 0 };
      result[category] = data.documents || [];
      result[category + 'Total'] = data.total || 0;
    }

    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    let userVotes: string[] = [];

    if (userId) {
      const votesRes = await fetch(WORKER_URL + '/bhasa-diwas/votes?voterId=' + encodeURIComponent(userId));
      if (votesRes.ok) userVotes = (await votesRes.json()).submissionIds || [];
    }

    return NextResponse.json({
      ...result,
      userVotes
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { error: 'लीडरबोर्ड लोड असफल' },
      { status: 500 }
    );
  }
}