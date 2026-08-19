#!/usr/bin/env node
// Copies every file from Appwrite Storage (article-image, app-downloads)
// into the matching R2 bucket, keyed by the original Appwrite file $id —
// same convention the Next.js app already uses in image URLs
// (`imageFileId`), so swapping call sites later is just a URL change, not
// a lookup change.
//
// Usage: APPWRITE_API_KEY=xxx node scripts/copy-storage-to-r2.mjs

import { Client, Storage, Query } from 'node-appwrite';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = 'khabardarjeeling';

const BUCKET_MAP = {
  'article-image': 'khabar-article-images',
  'app-downloads': 'khabar-downloads',
};

const apiKey = process.env.APPWRITE_API_KEY;
if (!apiKey) {
  console.error('Set APPWRITE_API_KEY first.');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(apiKey);
const storage = new Storage(client);

async function listAll(bucketId) {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await storage.listFiles(bucketId, queries);
    all.push(...res.files);
    if (res.files.length < 100) break;
    cursor = res.files[res.files.length - 1].$id;
  }
  return all;
}

async function withRetries(fn, label) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === 4) throw err;
      const delayMs = attempt * 2000;
      console.warn(`  retrying ${label} (attempt ${attempt} failed: ${err.message}), waiting ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function copyBucket(appwriteBucket, r2Bucket, tmpDir) {
  const files = await listAll(appwriteBucket);
  console.log(`${appwriteBucket}: ${files.length} files to copy -> ${r2Bucket}`);

  let done = 0;
  for (const file of files) {
    const bytes = await withRetries(
      () => storage.getFileDownload(appwriteBucket, file.$id),
      `download ${file.$id}`
    );
    const tmpPath = join(tmpDir, file.$id.replace(/[^a-zA-Z0-9_-]/g, '_'));
    writeFileSync(tmpPath, Buffer.from(bytes));

    await withRetries(
      () => execFileSync('npx', [
        'wrangler', 'r2', 'object', 'put',
        `${r2Bucket}/${file.$id}`,
        '--file', tmpPath,
        '--content-type', file.mimeType || 'application/octet-stream',
      ], { stdio: 'pipe', shell: true }),
      `upload ${file.$id}`
    );

    unlinkSync(tmpPath);
    done += 1;
    if (done % 10 === 0 || done === files.length) {
      console.log(`  ${done}/${files.length}`);
    }
  }
}

async function main() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'khabar-r2-'));
  try {
    for (const [appwriteBucket, r2Bucket] of Object.entries(BUCKET_MAP)) {
      await copyBucket(appwriteBucket, r2Bucket, tmpDir);
    }
  } finally {
    // tmp files are removed one-by-one above; directory itself is left for
    // the OS to reap (mkdtemp dirs are safe to leave, no secrets in them).
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('Copy failed:', err);
  process.exit(1);
});
