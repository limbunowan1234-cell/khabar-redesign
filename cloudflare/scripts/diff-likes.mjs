#!/usr/bin/env node
// Shadow-write validation: compares Appwrite (source of truth) against
// D1 for the `likes` collection, so drift shows up in a report instead
// of surfacing later as a bug once something actually depends on D1.
// Run this periodically during the validation window -- see
// cloudflare/README.md for what "periodically" means here and what to
// do if it finds real drift.
//
// Usage: APPWRITE_API_KEY=xxx node scripts/diff-likes.mjs

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

async function fetchAllAppwriteLikes() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(500)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, 'likes', queries);
    all.push(...res.documents);
    if (res.documents.length < 500) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return all;
}

function fetchAllD1Likes() {
  const cmd = `npx wrangler d1 execute khabar-d1 --remote --command "SELECT article_id, comment_id, user_id FROM likes" --json`;
  const out = execSync(cmd, { cwd: fileURLToPath(new URL('..', import.meta.url)), maxBuffer: 50 * 1024 * 1024 });
  const parsed = JSON.parse(out.toString());
  return parsed[0].results;
}

function key(articleId, commentId, userId) {
  return `${articleId}|${commentId || ''}|${userId}`;
}

async function main() {
  console.log('Fetching from Appwrite...');
  const appwriteLikes = await fetchAllAppwriteLikes();
  console.log(`  ${appwriteLikes.length} rows (before any de-dup -- Appwrite's collection has no real uniqueness constraint, see Week 8's notes)`);

  console.log('Fetching from D1...');
  const d1Likes = fetchAllD1Likes();
  console.log(`  ${d1Likes.length} rows`);

  const appwriteKeys = new Set(appwriteLikes.filter((l) => l.userId).map((l) => key(l.articleId, l.commentId, l.userId)));
  const d1Keys = new Set(d1Likes.map((l) => key(l.article_id, l.comment_id, l.user_id)));

  const onlyInAppwrite = [...appwriteKeys].filter((k) => !d1Keys.has(k));
  const onlyInD1 = [...d1Keys].filter((k) => !appwriteKeys.has(k));

  console.log('');
  console.log(`Appwrite (deduped, valid rows): ${appwriteKeys.size}`);
  console.log(`D1: ${d1Keys.size}`);
  console.log(`Only in Appwrite (not yet shadow-written, or drift): ${onlyInAppwrite.length}`);
  console.log(`Only in D1 (shouldn't happen -- investigate): ${onlyInD1.length}`);

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
