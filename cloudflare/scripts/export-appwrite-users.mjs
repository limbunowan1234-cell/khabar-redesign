#!/usr/bin/env node
// Phase 0 of the Appwrite-auth -> D1/Workers migration (see the migration
// plan). Appwrite Cloud's project is blocked project-wide by a
// billing_limit_exceeded 402 on every session/client API call (confirmed:
// GET /account, storage file list, storage file delete all 402). This
// script tests whether a *server API key* still works despite that -- some
// platforms deliberately leave server-key/data-export access open even
// when the account is over quota, specifically so customers can get their
// data out. That's unconfirmed here; this script is the test.
//
// If it works: dumps every user as {$id, email, name, labels} to
// users-export.json in this directory, ready for the Phase 2 bulk-seed
// step. Nothing here writes to D1 or anywhere else -- purely a read+dump.
//
// If it 402s too: the fallback is a manual export from the Appwrite
// Console's Auth -> Users page (dashboard access sometimes survives even
// when the API doesn't) -- see the migration plan for that path.
//
// Usage: APPWRITE_API_KEY=xxx node scripts/export-appwrite-users.mjs

import { Client, Users, Query } from 'node-appwrite';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = 'khabardarjeeling';

const apiKey = process.env.APPWRITE_API_KEY;
if (!apiKey) {
  console.error('Set APPWRITE_API_KEY first (find it in the Appwrite Console under Overview -> Integrate -> API keys, or Settings -> API keys for your project).');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(apiKey);
const users = new Users(client);

async function listAll() {
  const all = [];
  let cursor;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await users.list(queries);
    all.push(...res.users);
    if (res.users.length < 100) break;
    cursor = res.users[res.users.length - 1].$id;
  }
  return all;
}

try {
  console.log('Testing server-key access to Appwrite Users API (this project is 402-blocked for session/client calls, but server keys sometimes survive)...');
  const rawUsers = await listAll();
  const exported = rawUsers.map((u) => ({
    $id: u.$id,
    email: u.email,
    name: u.name,
    labels: u.labels || [],
  }));

  const outPath = join(dirname(fileURLToPath(import.meta.url)), 'users-export.json');
  writeFileSync(outPath, JSON.stringify(exported, null, 2));

  console.log(`\nSuccess -- server API key access works despite the billing block.`);
  console.log(`Exported ${exported.length} users to ${outPath}.`);
  console.log(`Next step: Phase 2 (bulk-seed the new D1 users table from this file).`);
} catch (err) {
  console.error(`\nServer-key access also failed: ${err.message}`);
  console.error('The billing block appears to cover this path too. Fall back to a manual export');
  console.error('from the Appwrite Console\'s Auth -> Users page (Console dashboard access sometimes');
  console.error('survives even when the API doesn\'t) -- see the migration plan\'s fallback path.');
  process.exit(1);
}
