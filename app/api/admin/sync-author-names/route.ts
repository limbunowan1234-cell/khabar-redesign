import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Users, Query } from 'node-appwrite';

const ADMIN_EMAIL = 'nowanad@gmail.com';

async function checkAdmin(jwt: string): Promise<{ ok: boolean }> {
  if (!jwt) return { ok: false };
  try {
    const res = await fetch('https://nyc.cloud.appwrite.io/v1/account', {
      headers: {
        'X-Appwrite-Project': 'khabardarjeeling',
        'X-Appwrite-JWT': jwt
      }
    });
    if (!res.ok) return { ok: false };
    const user = await res.json();
    const labels = user.labels || [];
    const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
    return { ok: isAdmin };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    const auth = await checkAdmin(jwt);
    if (!auth.ok) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const client = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');
    const databases = new Databases(client);
    const users = new Users(client);

    const allArticles = await databases.listDocuments('Khabar_db', 'articles', [Query.limit(500)]);
    const documents = allArticles.documents;

    const uniqueSubmitterIds = Array.from(new Set(documents.map((d: any) => d.submitterId).filter(Boolean)));
    const nameCache: Record<string, string> = {};

    for (const uid of uniqueSubmitterIds) {
      try {
        const u = await users.get(uid as string);
        nameCache[uid as string] = u.name;
      } catch {
        // user may have been deleted, skip
      }
    }

    let updatedCount = 0;
    for (const doc of documents) {
      const currentName = nameCache[doc.submitterId];
      if (currentName && doc.submitterName !== currentName) {
        await databases.updateDocument('Khabar_db', 'articles', doc.$id, { submitterName: currentName });
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, totalArticles: documents.length, updatedCount });
  } catch (error) {
    console.error('Sync author names error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}