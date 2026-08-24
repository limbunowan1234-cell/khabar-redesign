#!/usr/bin/env node
// Post-cutover check (Week 26): bookmarks write to D1 only now --
// Appwrite's bookmarks collection is frozen at whatever it held at
// cutover time. Same flip as diff-likes.mjs:
//   - "Only in Appwrite" should now stay flat forever going forward
//     (growing = real drift). It may already be nonzero at the Week 26
//     baseline though -- app/bookmarks/page.tsx's own remove-bookmark
//     had been calling Appwrite's DELETE with D1's row id instead of
//     Appwrite's real document id since Week 8 (silently no-op'ing,
//     never thrown), so some bookmarks removed via that page were
//     deleted from D1 but left orphaned in Appwrite. That's historical,
//     fixed by this cutover removing the Appwrite call entirely -- not
//     something to chase down further.
//   - "Only in D1" is now the expected, growing bucket for everything
//     that happens from here on.
//
// Usage: APPWRITE_API_KEY=xxx node scripts/diff-bookmarks.mjs

import { Client, Databases, Query } from 'node-appwrite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = 'khabardarjeeling';
const DB_ID = 'Khabar_db';

const apiKey = process.env.APPWRITE_API_KEY;
if (!apiKey) {
  console.error('Set APPWRITE_API_KEY first.');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(apiKey);
const databases = new Databases(client);

async function fetchAllAppwriteBookmarks() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(500)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, 'bookmarks', queries);
    all.push(...res.documents);
    if (res.documents.length < 500) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return all;
}

function fetchAllD1Bookmarks() {
  const cmd = `npx wrangler d1 execute khabar-d1 --remote --command "SELECT user_id, article_id FROM bookmarks" --json`;
  const out = execSync(cmd, { cwd: fileURLToPath(new URL('..', import.meta.url)), maxBuffer: 50 * 1024 * 1024 });
  const parsed = JSON.parse(out.toString());
  return parsed[0].results;
}

function key(userId, articleId) {
  return `${userId}|${articleId}`;
}

async function main() {
  console.log('Fetching from Appwrite...');
  const appwriteBookmarks = await fetchAllAppwriteBookmarks();
  console.log(`  ${appwriteBookmarks.length} rows (before any de-dup -- Appwrite's collection has no real uniqueness constraint, see Week 8's notes)`);

  console.log('Fetching from D1...');
  const d1Bookmarks = fetchAllD1Bookmarks();
  console.log(`  ${d1Bookmarks.length} rows`);

  const appwriteKeys = new Set(appwriteBookmarks.filter((b) => b.userId && b.articleId).map((b) => key(b.userId, b.articleId)));
  const d1Keys = new Set(d1Bookmarks.map((b) => key(b.user_id, b.article_id)));

  const onlyInAppwrite = [...appwriteKeys].filter((k) => !d1Keys.has(k));
  const onlyInD1 = [...d1Keys].filter((k) => !appwriteKeys.has(k));

  console.log('');
  console.log(`Appwrite (deduped, valid rows): ${appwriteKeys.size}`);
  console.log(`D1: ${d1Keys.size}`);
  console.log(`Only in Appwrite (frozen since Week 26 cutover -- may be nonzero at baseline from the pre-cutover removeBookmark bug, see header comment; growing after today = real drift): ${onlyInAppwrite.length}`);
  console.log(`Only in D1 (expected and growing since Week 26 -- every bookmark/unbookmark since cutover only lands here): ${onlyInD1.length}`);

  if (onlyInAppwrite.length > 0) {
    console.log('\nSample of Appwrite-only keys (up to 10):');
    onlyInAppwrite.slice(0, 10).forEach((k) => console.log('  ' + k));
  }
  if (onlyInD1.length > 0) {
    console.log('\nSample of D1-only keys (up to 10):');
    onlyInD1.slice(0, 10).forEach((k) => console.log('  ' + k));
  }
}

main().catch((err) => {
  console.error('Diff failed:', err);
  process.exit(1);
});
