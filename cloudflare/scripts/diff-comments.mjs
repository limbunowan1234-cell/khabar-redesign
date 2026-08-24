#!/usr/bin/env node
// Post-cutover check (Week 28): comments write to D1 only now, for the
// three real client call sites (article comments, contest discussion,
// Hills in Frame) -- Appwrite's comments collection is frozen for those.
// Different from diff-likes.mjs/diff-bookmarks.mjs/diff-follows.mjs
// though: the Bhasa Diwas comments POST route is a deliberate, ongoing
// exclusion (server-side, admin API key, no per-user JWT to reuse -- see
// cloudflare/README.md) and was never shadow-written or cut over. So:
//   - "Only in Appwrite" will keep growing, but only from new Bhasa
//     Diwas comments -- that's expected and fine. A growing count made
//     up of anything else would be real drift, worth investigating.
//   - "Only in D1" is the expected, growing bucket for the three real
//     cut-over call sites.
// Compares by id (Appwrite's real $id from before the cutover; D1's own
// generated id for everything after) rather than a natural key.
//
// Usage: APPWRITE_API_KEY=xxx node scripts/diff-comments.mjs

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

async function fetchAllAppwriteComments() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(500)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, 'comments', queries);
    all.push(...res.documents);
    if (res.documents.length < 500) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return all;
}

function fetchAllD1Comments() {
  const cmd = `npx wrangler d1 execute khabar-d1 --remote --command "SELECT id FROM comments" --json`;
  const out = execSync(cmd, { cwd: fileURLToPath(new URL('..', import.meta.url)), maxBuffer: 50 * 1024 * 1024 });
  const parsed = JSON.parse(out.toString());
  return parsed[0].results;
}

async function main() {
  console.log('Fetching from Appwrite...');
  const appwriteComments = await fetchAllAppwriteComments();
  console.log(`  ${appwriteComments.length} rows`);

  console.log('Fetching from D1...');
  const d1Comments = fetchAllD1Comments();
  console.log(`  ${d1Comments.length} rows`);

  const appwriteIds = new Set(appwriteComments.filter((c) => c.userId).map((c) => c.$id));
  const d1Ids = new Set(d1Comments.map((c) => c.id));

  const onlyInAppwrite = [...appwriteIds].filter((id) => !d1Ids.has(id));
  const onlyInD1 = [...d1Ids].filter((id) => !appwriteIds.has(id));

  console.log('');
  console.log(`Appwrite (with a userId): ${appwriteIds.size}`);
  console.log(`D1: ${d1Ids.size}`);
  console.log(`Only in Appwrite (expected to keep growing, but only from new Bhasa Diwas comments -- that write path is still Appwrite-only; growth from anything else is real drift): ${onlyInAppwrite.length}`);
  console.log(`Only in D1 (expected and growing since Week 28 -- every article/contest/Hills-in-Frame comment since cutover only lands here): ${onlyInD1.length}`);

  if (onlyInD1.length > 0) {
    console.log('\nSample of D1-only ids (up to 10):');
    onlyInD1.slice(0, 10).forEach((id) => console.log('  ' + id));
  }
}

main().catch((err) => {
  console.error('Diff failed:', err);
  process.exit(1);
});
