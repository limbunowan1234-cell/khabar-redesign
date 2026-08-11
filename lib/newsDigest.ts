import { Client, Databases, ID } from 'node-appwrite';

const DB_ID = 'Khabar_db';
const COLLECTION_ID = 'news_digest';
const DOC_ID = 'main';

function getDatabases(): Databases {
  const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
    .setKey(process.env.APPWRITE_API_KEY || '');
  return new Databases(client);
}

export interface DigestPayload {
  sectionsJson: string; // JSON-stringified DigestSection[]
  lastVerified: string;
  updatedAt: string;
}

async function ensureCollection(databases: Databases): Promise<void> {
  try {
    await databases.getCollection(DB_ID, COLLECTION_ID);
  } catch {
    try {
      await databases.createCollection(DB_ID, COLLECTION_ID, 'News Digest', undefined, true);
      await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'sectionsJson', 1000000, true);
      await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'lastVerified', 255, true);
      await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'updatedAt', 255, true);
      // Give the attributes a moment to become available before first write.
      await new Promise((r) => setTimeout(r, 3000));
    } catch (createErr) {
      throw new Error(
        'news_digest collection is missing and could not be auto-created (API key may lack permission). ' +
        'Create it manually in Appwrite: database Khabar_db, collection id "news_digest", ' +
        'string attributes sectionsJson (size 1000000), lastVerified (255), updatedAt (255). Original error: ' +
        (createErr as Error).message
      );
    }
  }
}

export async function getDigest(): Promise<DigestPayload | null> {
  const databases = getDatabases();
  try {
    const doc = await databases.getDocument(DB_ID, COLLECTION_ID, DOC_ID);
    return {
      sectionsJson: (doc as any).sectionsJson,
      lastVerified: (doc as any).lastVerified,
      updatedAt: (doc as any).updatedAt,
    };
  } catch {
    return null;
  }
}

export async function saveDigest(payload: DigestPayload): Promise<void> {
  const databases = getDatabases();
  await ensureCollection(databases);
  try {
    await databases.updateDocument(DB_ID, COLLECTION_ID, DOC_ID, payload as unknown as Record<string, unknown>);
  } catch {
    await databases.createDocument(DB_ID, COLLECTION_ID, DOC_ID, payload as unknown as Record<string, unknown>);
  }
}

// Re-exported in case a future caller needs a fresh unique id for something else.
export { ID };
