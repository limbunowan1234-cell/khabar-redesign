export function selectHeroPool(articles: any[]) {
  const featured = articles.filter((a: any) => a.isFeatured);
  const pool = featured.length >= 4 ? featured : [...featured, ...articles.filter((a: any) => !a.isFeatured)];
  return { main: pool[0], side: pool.slice(1, 3) };
}

export function selectLatestRoundRobin(articles: any[], excludeIds: Set<string>, count: number): any[] {
  const remaining = articles.filter((a: any) => !excludeIds.has(a.$id));
  const byGenre: Record<string, any[]> = {};
  const order: string[] = [];
  for (const a of remaining) {
    const g = a.genre || a.category || 'News';
    if (!byGenre[g]) {
      byGenre[g] = [];
      order.push(g);
    }
    byGenre[g].push(a);
  }
  const result: any[] = [];
  let i = 0;
  let guard = 0;
  while (result.length < count && order.some((g) => byGenre[g].length > 0) && guard < 5000) {
    const g = order[i % order.length];
    if (byGenre[g].length > 0) {
      result.push(byGenre[g].shift());
    }
    i++;
    guard++;
  }
  return result;
}