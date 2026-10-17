// lib/topics.ts
// Ongoing-story pages (/topic/[slug]). The article API has no text search,
// so app/topic/[slug]/page.tsx pulls recent published articles and keeps
// the ones whose title or content mentions any of `keywords` (matched
// case-insensitively). Add a topic here and it gets a page, a sitemap entry
// and a footer link automatically.
export type Topic = {
  slug: string;
  name: string;
  description: string; // meta description, ~150 chars
  intro: string;       // shown on the page above the story list
  keywords: string[];
};

export const TOPICS: Topic[] = [
  {
    slug: 'gorkhaland',
    name: 'Gorkhaland',
    description: 'Latest news and analysis on the Gorkhaland statehood demand, hill politics and the Gorkha community in Darjeeling, Kalimpong and Kurseong.',
    intro: 'The demand for a separate state of Gorkhaland has shaped politics in the Darjeeling hills for decades. This page collects our reporting on the statehood movement, the parties and leaders involved, talks with the state and central governments, and what it all means for people across Darjeeling, Kalimpong, Kurseong and Mirik.',
    keywords: ['gorkhaland'],
  },
  {
    slug: 'gta',
    name: 'GTA',
    description: 'News on the Gorkhaland Territorial Administration (GTA): elections, Sabha decisions, budgets, recruitment and development work in the Darjeeling hills.',
    intro: 'The Gorkhaland Territorial Administration (GTA) is the semi-autonomous body that runs many departments in the Darjeeling and Kalimpong hills. Follow our coverage of GTA elections, Sabha meetings, budgets, recruitment, and the development projects it funds and delays.',
    keywords: ['gta', 'gorkhaland territorial administration'],
  },
  {
    slug: 'landslides',
    name: 'Landslides and Monsoon',
    description: 'Landslide, road closure and monsoon updates for Darjeeling, Kalimpong, Mirik and Sikkim, including NH10 and rescue and relief news.',
    intro: 'Every monsoon, landslides cut roads, damage homes and isolate villages across the Darjeeling and Sikkim hills. This page brings together our reports on landslides, road closures on NH10 and hill routes, rainfall warnings, rescue and relief work, and the longer story of a changing climate in the Himalaya.',
    keywords: ['landslide', 'landslides', 'monsoon', 'nh10', 'nh 10', 'road closure', 'heavy rain', 'flood'],
  },
  {
    slug: 'tea-gardens',
    name: 'Tea Gardens',
    description: 'News from Darjeeling tea gardens: workers, wages, bonus, land rights, closures, harvests and the Darjeeling tea industry.',
    intro: 'Darjeeling tea is known around the world, but the gardens are also home and workplace for thousands of families. Our coverage follows tea garden workers, wages and bonus, land rights, closures and reopenings, harvests and prices, and the future of the Darjeeling tea industry.',
    keywords: ['tea garden', 'tea gardens', 'tea estate', 'tea worker', 'tea workers', 'darjeeling tea', 'plantation'],
  },
];

export function getTopic(slug: string): Topic | null {
  return TOPICS.find((t) => t.slug === slug) || null;
}

// Whole-word match so 'gta' doesn't match inside other words.
export function matchesTopic(article: any, topic: Topic): boolean {
  const text = ((article?.title || '') + ' ' + (article?.content || '')).toLowerCase();
  return topic.keywords.some((k) => new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(text));
}
