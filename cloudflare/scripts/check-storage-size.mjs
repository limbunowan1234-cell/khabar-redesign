#!/usr/bin/env node
// One-off: sums file count + bytes for both Appwrite storage buckets, to
// check actual usage against R2's 10GB free tier before migrating (this
// was flagged as an estimate-only risk in the migration plan — this
// script replaces the estimate with a real number).
//
// Usage: APPWRITE_API_KEY=xxx node scripts/check-storage-size.mjs

import { Client, Storage, Query } from 'node-appwrite';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = 'khabardarjeeling';
const BUCKETS = ['article-image', 'app-downloads'];

const apiKey = process.env.APPWRITE_API_KEY;
if (!apiKey) {
  console.error('Set APPWRITE_API_KEY first.');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(apiKey);
const storage = new Storage(client);

async function sumBucket(bucketId) {
  let total = 0;
  let count = 0;
  let cursor;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await storage.listFiles(bucketId, queries);
    for (const f of res.files) total += f.sizeOriginal;
    count += res.files.length;
    if (res.files.length < 100) break;
    cursor = res.files[res.files.length - 1].$id;
  }
  return { count, bytes: total };
}

for (const bucketId of BUCKETS) {
  const { count, bytes } = await sumBucket(bucketId);
  console.log(`${bucketId}: ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB (${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB)`);
}
