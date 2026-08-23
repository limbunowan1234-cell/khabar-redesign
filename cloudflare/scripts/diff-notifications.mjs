#!/usr/bin/env node
// Sanity check: notifications is read-only from D1 as of Week 18, but
// nothing writes to D1 for it yet (creating one, and marking read, both
// still land on Appwrite only -- see cloudflare/README.md). Compares by
// id, same as diff-comments.mjs. Run this periodically to catch drift
// before it's relied on for anything beyond display.
//
// Usage: APPWRITE_API_KEY=xxx node scripts/diff-notifications.mjs

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

async function fetchAllAppwriteNotifications() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(500)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, 'notifications', queries);
    all.push(...res.documents);
    if (res.documents.length < 500) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return all;
}

function fetchAllD1Notifications() {
  const cmd = `npx wrangler d1 execute khabar-d1 --remote --command "SELECT id, read FROM notifications" --json`;
  const out = execSync(cmd, { cwd: fileURLToPath(new URL('..', import.meta.url)), maxBuffer: 50 * 1024 * 1024 });
  const parsed = JSON.parse(out.toString());
  return parsed[0].results;
}

async function main() {
  console.log('Fetching from Appwrite...');
  const appwriteNotifs = await fetchAllAppwriteNotifications();
  console.log(`  ${appwriteNotifs.length} rows`);

  console.log('Fetching from D1...');
  const d1Notifs = fetchAllD1Notifications();
  console.log(`  ${d1Notifs.length} rows`);

  const appwriteById = new Map(appwriteNotifs.map((n) => [n.$id, n]));
  const d1ById = new Map(d1Notifs.map((n) => [n.id, n]));

  const onlyInAppwrite = [...appwriteById.keys()].filter((id) => !d1ById.has(id));
  const onlyInD1 = [...d1ById.keys()].filter((id) => !appwriteById.has(id));

  let readDrift = 0;
  for (const [id, n] of appwriteById) {
    const d1n = d1ById.get(id);
    if (d1n && !!n.read !== !!d1n.read) readDrift++;
  }

  console.log('');
  console.log(`Appwrite: ${appwriteById.size}`);
  console.log(`D1: ${d1ById.size}`);
  console.log(`Only in Appwrite (not yet exported, or drift): ${onlyInAppwrite.length}`);
  console.log(`Only in D1 (shouldn't happen -- investigate): ${onlyInD1.length}`);
  console.log(`Read-state drift (expected -- markRead/markAllRead only write to Appwrite so far): ${readDrift}`);

  if (onlyInD1.length > 0) {
    console.log('\nSample of D1-only ids (up to 10):');
    onlyInD1.slice(0, 10).forEach((id) => console.log('  ' + id));
  }
}

main().catch((err) => {
  console.error('Diff failed:', err);
  process.exit(1);
});
