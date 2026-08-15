import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases } from 'node-appwrite';

const ADMIN_EMAIL = 'nowanad@gmail.com';
const DB_ID = 'Khabar_db';
const COLLECTION_ID = 'contest_settings';
const DOC_ID = 'main';

async function checkAdminJwt(jwt: string | null): Promise<boolean> {
  if (!jwt) return false;
  try {
    const res = await fetch('https://nyc.cloud.appwrite.io/v1/account', {
      headers: {
        'X-Appwrite-Project': 'khabardarjeeling',
        'X-Appwrite-JWT': jwt,
      },
    });
    if (!res.ok) return false;
    const user = await res.json();
    const labels = user.labels || [];
    return user.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin');
  } catch {
    return false;
  }
}

function getDatabases(): Databases {
  const client = new Client()
    .setEndpoint('https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
    .setKey(process.env.APPWRITE_API_KEY || '');
  return new Databases(client);
}

async function ensurePinnedCommentIdAttribute(databases: Databases): Promise<void> {
  try {
    await databases.createStringAttribute(DB_ID, COLLECTION_ID, 'pinnedCommentId', 255, false);
    // Give the new attribute a moment to become available before first write.
    await new Promise((r) => setTimeout(r, 3000));
  } catch {
    // Already exists (or collection doesn't support it) — either way, the
    // caller's write attempt will surface any real problem.
  }
}

// Pinning is stored as a single commentId reference on the existing
// contest_settings/main document (same doc as certificatesLive) rather than
// per-comment state, since only one message can be pinned at a time. Writes
// go through the service API key for the same reason publish-certificates
// does: the browser session alone can't reliably write to this document.
export async function POST(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (!process.env.APPWRITE_API_KEY) {
    console.error('pin-comment error: APPWRITE_API_KEY is not set');
    return NextResponse.json({ error: 'Server is missing APPWRITE_API_KEY.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const pinnedCommentId: string | null = body.commentId || null;
    const databases = getDatabases();

    async function write() {
      try {
        await databases.updateDocument(DB_ID, COLLECTION_ID, DOC_ID, { pinnedCommentId });
      } catch {
        await databases.createDocument(DB_ID, COLLECTION_ID, DOC_ID, { pinnedCommentId });
      }
    }

    try {
      await write();
    } catch {
      // Most likely cause: pinnedCommentId doesn't exist as an attribute
      // yet on this collection. Create it and retry once.
      await ensurePinnedCommentIdAttribute(databases);
      await write();
    }

    return NextResponse.json({ success: true, pinnedCommentId });
  } catch (error) {
    console.error('pin-comment error:', error);
    return NextResponse.json({ error: 'Failed to update pinned comment' }, { status: 500 });
  }
}
