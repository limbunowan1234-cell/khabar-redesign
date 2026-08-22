#!/usr/bin/env node
// Shadow-write validation: compares Appwrite (source of truth) against
// D1 for the `comments` collection, so drift shows up in a report
// instead of surfacing later as a bug once something actually depends
// on D1. Comments aren't a toggle like likes/bookmarks/follows -- they
// compare by id (Appwrite's real $id, which the shadow-write always
// reuses) rather than a natural key.
// Run this periodically during the validation window -- see
// cloudflare/README.md for what "periodically" means here and what to
// do if it finds real drift.
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
  console.log(`Only in Appwrite (not yet shadow-written, or drift -- Bhasa Diwas comments included, since that write path doesn't shadow-write yet): ${onlyInAppwrite.length}`);
  console.log(`Only in D1 (shouldn't happen -- investigate): ${onlyInD1.length}`);

  if (onlyInD1.length > 0) {
    console.log('\nSample of D1-only ids (up to 10):');
    onlyInD1.slice(0, 10).forEach((id) => console.log('  ' + id));
  }
}

main().catch((err) => {
  console.error('Diff failed:', err);
  process.exit(1);
});
