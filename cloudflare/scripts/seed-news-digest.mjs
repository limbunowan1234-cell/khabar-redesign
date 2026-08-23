#!/usr/bin/env node
// One-time backfill: news_digest is a single-row admin cache that predates
// this migration and was never exported. Pulls the real current Appwrite
// row and writes db/seed-news-digest.sql so it can be imported into D1
// before any read gets pointed there -- same reasoning as Week 16's
// contest_settings fix (reading a stale/empty row would be a regression,
// not a no-op).
//
// Usage: APPWRITE_API_KEY=xxx node scripts/seed-news-digest.mjs

import { Client, Databases } from 'node-appwrite';
import { writeFileSync } from 'node:fs';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = 'khabardarjeeling';
const DB_ID = 'Khabar_db';

const apiKey = process.env.APPWRITE_API_KEY;
if (!apiKey) { console.error('Set APPWRITE_API_KEY first.'); process.exit(1); }

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(apiKey);
const databases = new Databases(client);

function sqlString(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  let doc;
  try {
    doc = await databases.getDocument(DB_ID, 'news_digest', 'main');
  } catch (err) {
    console.error('No news_digest/main document in Appwrite yet -- nothing to seed.', err.message);
    process.exit(0);
  }

  const sql = `UPDATE news_digest SET sections_json = ${sqlString(doc.sectionsJson)}, last_verified = ${sqlString(doc.lastVerified)}, updated_at = ${sqlString(doc.updatedAt)} WHERE id = 1;\n`;
  writeFileSync(new URL('../db/seed-news-digest.sql', import.meta.url), sql);
  console.log(`Wrote db/seed-news-digest.sql (sectionsJson: ${doc.sectionsJson.length} chars, lastVerified: ${doc.lastVerified})`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
