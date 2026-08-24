#!/usr/bin/env node
// Post-cutover check (Week 34): articles write to D1 only now for every
// client-side path -- create, edit, delete, flag toggles, weekly-picks
// management, curate hero/pin. Appwrite's articles collection is frozen
// for those. All four counts here should stay at zero going forward,
// with one known exception: the two cron-triggered weekly-publish
// routes (app/api/publish-weekly, app/api/revalidate-sitemaps's Sunday
// auto-publish) are a deliberate, documented exclusion -- no per-admin
// JWT available to a cron job -- and still write weeklyLive/weeklyIssue
// to Appwrite only. Expect real (small, weekly-fields-only) drift right
// after those fire; anything else nonzero is a real problem.
//
// Usage: APPWRITE_API_KEY=xxx node scripts/diff-articles.mjs

import { Client, Databases, Query } from 'node-appwrite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = 'khabardarjeeling';
const DB_ID = 'Khabar_db';

const apiKey = process.env.APPWRITE_API_KEY;
if (!apiKey) { console.error('Set APPWRITE_API_KEY first.'); process.exit(1); }

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(apiKey);
const databases = new Databases(client);

async function fetchAll() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(200)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, 'articles', queries);
    all.push(...res.documents);
    if (res.documents.length < 200) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return all;
}

const appwriteArticles = await fetchAll();
console.log(`Appwrite: ${appwriteArticles.length} articles`);

const cmd = `npx wrangler d1 execute khabar-d1 --remote --command "SELECT id, status, is_genre_featured, is_genre_pinned, is_region_featured, is_region_pinned, is_weekly_pick, weekly_live, title, updated_at FROM articles" --json`;
const out = execSync(cmd, { cwd: fileURLToPath(new URL('..', import.meta.url)), maxBuffer: 50 * 1024 * 1024 });
const d1Rows = JSON.parse(out.toString())[0].results;
const d1ById = new Map(d1Rows.map(r => [r.id, r]));
console.log(`D1: ${d1Rows.length} articles`);

let statusDrift = 0, flagDrift = 0, titleDrift = 0, missingInD1 = 0;
const statusExamples = [];
const flagExamples = [];
const titleExamples = [];

for (const a of appwriteArticles) {
  const d1 = d1ById.get(a.$id);
  if (!d1) { missingInD1++; continue; }
  if (a.status !== d1.status) {
    statusDrift++;
    if (statusExamples.length < 10) statusExamples.push({ id: a.$id, title: a.title, appwrite: a.status, d1: d1.status });
  }
  const flagsMatch =
    !!a.isGenreFeatured === !!d1.is_genre_featured &&
    !!a.isGenrePinned === !!d1.is_genre_pinned &&
    !!a.isRegionFeatured === !!d1.is_region_featured &&
    !!a.isRegionPinned === !!d1.is_region_pinned &&
    !!a.isWeeklyPick === !!d1.is_weekly_pick &&
    !!a.weeklyLive === !!d1.weekly_live;
  if (!flagsMatch) {
    flagDrift++;
    if (flagExamples.length < 10) flagExamples.push({ id: a.$id, title: a.title });
  }
  if ((a.title || '') !== (d1.title || '')) {
    titleDrift++;
    if (titleExamples.length < 5) titleExamples.push({ id: a.$id, appwrite: a.title, d1: d1.title });
  }
}

console.log('');
console.log(`Missing in D1: ${missingInD1}`);
console.log(`Status drift: ${statusDrift}`);
statusExamples.forEach(e => console.log('  ' + JSON.stringify(e)));
console.log(`Curation-flag drift (featured/pinned/weekly): ${flagDrift}`);
flagExamples.forEach(e => console.log('  ' + JSON.stringify(e)));
console.log(`Title drift: ${titleDrift}`);
titleExamples.forEach(e => console.log('  ' + JSON.stringify(e)));
