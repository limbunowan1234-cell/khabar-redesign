// lib/textPreview.ts
// Article content can contain the markdown syntax ArticleClient.tsx's
// renderContent() knows how to render (## headings, **bold**, > quotes,
// | table | rows |, [text](links)) -- but every "deck"/preview snippet
// shown on cards elsewhere (hero decks, genre/region listings, homepage
// feed previews) is plain truncated text, not a markdown renderer, so
// left alone that syntax shows up literally -- e.g. a preview starting
// mid-table read "## The Aid Timeline | Flight | Date | ..." instead of
// prose. Strip it down to plain text before truncating, anywhere a
// preview is built from raw article.content.
export function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .filter((line) => !line.trim().startsWith('|')) // whole table rows, not just the pipes
    .map((line) => line.trim().replace(/^#{1,6}\s+/, '').replace(/^>+\s*/, ''))
    .join(' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Word-based truncation (for card previews measured in words).
export function truncateWords(text: string, words: number): string {
  const clean = stripMarkdown(text);
  if (!clean) return '';
  const w = clean.split(' ').slice(0, words).join(' ');
  return clean.split(' ').length > words ? w + '...' : w;
}

// Character-based truncation (for "deck" fields measured in characters).
export function truncateChars(text: string, chars: number): string {
  const clean = stripMarkdown(text);
  if (!clean) return '';
  return clean.length > chars ? clean.slice(0, chars).trim() + '...' : clean;
}
