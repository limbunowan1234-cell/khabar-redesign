import { Client, Databases, ID, Query, DatabasesIndexType } from 'node-appwrite';

const DB_ID = 'Khabar_db';
const COLLECTION_ID = 'analytics_events';

export interface AnalyticsEvent {
  visitorId: string;
  userId: string | null;
  eventType: 'view' | 'comment' | 'like';
  articleId: string | null;
  userCountry: string | null;
  timestamp: string;
}

function getDatabases(): Databases {
  const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
    .setKey(process.env.APPWRITE_API_KEY || '');
  return new Databases(client);
}

async function ensureCollection(databases: Databases): Promise<void> {
  try {
    await databases.getCollection(DB_ID, COLLECTION_ID);
  } catch {
    try {
      await databases.createCollection(DB_ID, COLLECTION_ID, 'Analytics Events', undefined, true);
      await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'visitorId', 128, true);
      await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'userId', 128, false);
      await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'eventType', 32, true);
      await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'articleId', 128, false);
      await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'userCountry', 64, false);
      await databases.createDatetimeAttribute(DB_ID, COLLECTION_ID, 'timestamp', true);
      // Give the attributes a moment to become available before first write/index.
      await new Promise((r) => setTimeout(r, 3000));
      await databases.createIndex(DB_ID, COLLECTION_ID, 'timestamp_idx', DatabasesIndexType.Key, ['timestamp']);
      await databases.createIndex(DB_ID, COLLECTION_ID, 'visitor_idx', DatabasesIndexType.Key, ['visitorId']);
    } catch (createErr) {
      throw new Error(
        'analytics_events collection is missing and could not be auto-created (API key may lack permission). ' +
        'Create it manually in Appwrite: database Khabar_db, collection id "analytics_events", ' +
        'string attributes visitorId(128,required), userId(128), eventType(32,required), articleId(128), userCountry(64), ' +
        'datetime attribute timestamp(required). Original error: ' + (createErr as Error).message
      );
    }
  }
}

export async function recordEvent(event: AnalyticsEvent): Promise<void> {
  const databases = getDatabases();
  await ensureCollection(databases);
  await databases.createDocument(DB_ID, COLLECTION_ID, ID.unique(), event as unknown as Record<string, unknown>);
}

export async function fetchEventsSince(sinceIso: string): Promise<any[]> {
  const databases = getDatabases();
  await ensureCollection(databases);
  const all: any[] = [];
  let cursor: string | undefined;
  // Analytics events are pruned to a 30-day rolling window (see the cleanup
  // route), so this is bounded — no need for a separate daily-rollup table.
  for (let page = 0; page < 20; page++) {
    const queries = [
      Query.greaterThanEqual('timestamp', sinceIso),
      Query.orderAsc('timestamp'),
      Query.limit(500),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DB_ID, COLLECTION_ID, queries);
    all.push(...res.documents);
    if (res.documents.length < 500) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return all;
}

export async function deleteEventsOlderThan(cutoffIso: string): Promise<number> {
  const databases = getDatabases();
  await ensureCollection(databases);
  let deleted = 0;
  for (let page = 0; page < 50; page++) {
    const res = await databases.listDocuments(DB_ID, COLLECTION_ID, [
      Query.lessThan('timestamp', cutoffIso),
      Query.limit(100),
    ]);
    if (res.documents.length === 0) break;
    await Promise.all(res.documents.map((d) => databases.deleteDocument(DB_ID, COLLECTION_ID, d.$id)));
    deleted += res.documents.length;
    if (res.documents.length < 100) break;
  }
  return deleted;
}
