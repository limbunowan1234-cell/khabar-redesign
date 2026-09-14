import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Users, Query } from 'node-appwrite';
import { checkAdminJwt } from '@/lib/serverAuth';

// Deliberately excluded from the Cloudflare migration -- a one-time tool
// against Appwrite's OWN Databases API (Khabar_db/articles), not D1, so
// it's untouched by every other cutover in this app. The admin check
// below is repointed at the new JWT system for consistency with every
// other admin route, but the sync operation itself still targets
// Appwrite's Databases/Users API directly -- which is unreachable now
// that the whole Appwrite project is behind the billing_limit_exceeded
// 402 this migration exists because of (see the migration plan). This
// route will 403/500 in practice until/unless Appwrite access is
// restored; not rewritten against D1 since that was an explicit,
// separate decision from the start, not something this migration should
// silently reverse.
export async function POST(req: NextRequest) {
  try {
    const { jwt } = await req.json();
    const isAdmin = await checkAdminJwt(jwt);
    if (!isAdmin) {
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