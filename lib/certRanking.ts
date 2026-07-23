// lib/certRanking.ts
// Computes contest rankings the same way the public leaderboard does:
// score = views*0.5 + likes*1 + comments*3, using real counts from the
// likes/comments collections (not the article document's own fields).

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

export interface RankedEntry {
  articleId: string;
  submitterId: string;
  submitterName: string;
  title: string;
  score: number;
  rank: number; // 1-based
}

export async function computeContestRankings(): Promise<RankedEntry[]> {
  const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'isContestEntry', values: [true] }));
  const q2 = encodeURIComponent(JSON.stringify({ method: 'limit', values: [200] }));
  const res = await fetch(`${ENDPOINT}/databases/${DB}/collections/articles/documents?queries[]=${q1}&queries[]=${q2}`, { headers: H });
  if (!res.ok) return [];
  const data = await res.json();
  const articles: any[] = data.documents || [];

  const enriched = await Promise.all(articles.map(async (a) => {
    let votes = 0;
    let comments = 0;
    try {
      const lq = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [a.$id] }));
      const lRes = await fetch(`${ENDPOINT}/databases/${DB}/collections/likes/documents?queries[]=${lq}`, { headers: H });
      if (lRes.ok) {
        const lData = await lRes.json();
        votes = (lData.documents || []).filter((l: any) => !l.commentId).length;
      }
    } catch {}
    try {
      const cq = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [a.$id] }));
      const cRes = await fetch(`${ENDPOINT}/databases/${DB}/collections/comments/documents?queries[]=${cq}`, { headers: H });
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

  enriched.sort((a, b) => b.score - a.score);
  return enriched.map((e, i) => ({ ...e, rank: i + 1 }));
}

export function rankToCertRank(rank: number): '1st' | '2nd' | '3rd' | 'participation' {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return 'participation';
}
