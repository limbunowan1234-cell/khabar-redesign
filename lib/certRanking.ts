// lib/certRanking.ts
// Computes contest rankings the same way the public leaderboard does:
// score = views*0.5 + likes*1 + comments*3, using real counts from the
// likes/comments collections (not the article document's own fields).

// Week 8 of the Cloudflare migration (see cloudflare/README.md): contest
// entries, likes, and comments all read from the Worker now.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

export interface RankedEntry {
  articleId: string;
  submitterId: string;
  submitterName: string;
  title: string;
  score: number;
  rank: number; // 1-based
}

// Contest results are final as of this instant — votes cast at or after it
// don't count toward rankings or certificates. Shared by the public
// results page, the admin certificate tool, and the profile page so all
// three agree on the same frozen standings.
export const CONTEST_VOTE_CUTOFF_MS = new Date('2026-08-14T19:15:57Z').getTime();

export async function computeContestRankings(): Promise<RankedEntry[]> {
  const res = await fetch(`${WORKER_URL}/articles?contest=1&limit=200`);
  if (!res.ok) return [];
  const data = await res.json();
  const articles: any[] = data.documents || [];

  const enriched = await Promise.all(articles.map(async (a) => {
    let votes = 0;
    let comments = 0;
    try {
      const lRes = await fetch(`${WORKER_URL}/likes?articleId=${encodeURIComponent(a.$id)}`);
      if (lRes.ok) {
        const lData = await lRes.json();
        votes = (lData.documents || []).filter((l: any) => new Date(l.$createdAt).getTime() < CONTEST_VOTE_CUTOFF_MS).length;
      }
    } catch {}
    try {
      const cRes = await fetch(`${WORKER_URL}/comments?articleId=${encodeURIComponent(a.$id)}`);
      if (cRes.ok) {
        const cData = await cRes.json();
        comments = cData.total || 0;
      }
    } catch {}
    const score = (a.views || 0) * 0.5 + votes * 1 + comments * 3;
    return {
      articleId: a.$id,
      submitterId: a.submitterId || '',
      submitterName: a.submitterName || a.authorName || 'Unknown',
      title: a.title || '',
      score,
    };
  }));

  // Keep only each author's single best-scoring entry. Without this, an
  // author with several contest entries could occupy multiple ranks and
  // receive multiple certificates, and would also crowd out other authors
  // from the actual top placements.
  const bestPerAuthor = new Map<string, (typeof enriched)[number]>();
  for (const entry of enriched) {
    const key = entry.submitterId || entry.articleId;
    const existing = bestPerAuthor.get(key);
    if (!existing || entry.score > existing.score) bestPerAuthor.set(key, entry);
  }
  const deduped = Array.from(bestPerAuthor.values());

  deduped.sort((a, b) => b.score - a.score);
  return deduped.map((e, i) => ({ ...e, rank: i + 1 }));
}

export function rankToCertRank(rank: number): '1st' | '2nd' | '3rd' | 'participation' {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return 'participation';
}
