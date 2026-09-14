import { NextRequest, NextResponse } from 'next/server';

// Week 11 of the Cloudflare migration (see cloudflare/README.md). These
// comments reuse the same `comments` table as articles/contest, scoped
// by articleId = submissionId, same pseudo-id trick as the contest
// discussion -- already covered by the existing /comments Worker route.
// Posting (Week 44 fix) now calls the Worker directly from the client
// (see BhasaDiwasSubmissionDetail.tsx) with a bearer JWT, matching how
// likes/bookmarks already work -- no Next.js proxy needed for that side.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const submissionId = searchParams.get('submissionId');

    if (!submissionId) {
      return NextResponse.json({ error: 'submissionId आवश्यक छ' }, { status: 400 });
    }

    const res = await fetch(WORKER_URL + '/comments?articleId=' + encodeURIComponent(submissionId));
    const data = res.ok ? await res.json() : { documents: [] };

    const mapped = (data.documents || []).slice(0, 100).map((doc: any) => ({
      $id: doc.$id,
      $createdAt: doc.$createdAt,
      userName: doc.authorName,
      text: doc.commentText
    }));

    return NextResponse.json({ comments: mapped });
  } catch (error) {
    console.error('Fetch comments error:', error);
    return NextResponse.json({ error: 'टिप्पणी लोड असफल' }, { status: 500 });
  }
}
