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

// The contest_settings/main document was created with empty $permissions,
// so PATCHing it from the browser with just the admin's user session was
// silently failing (Appwrite returned an error the old client code never
// checked). Writing through this server route with the service API key
// sidesteps that permission gap entirely.
export async function POST(req: NextRequest) {
  const jwt = req.headers.get('x-admin-jwt');
  const isAdmin = await checkAdminJwt(jwt);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  if (!process.env.APPWRITE_API_KEY) {
    console.error('publish-certificates error: APPWRITE_API_KEY is not set');
    return NextResponse.json({ error: 'Server is missing APPWRITE_API_KEY.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const live = !!body.live;
    const databases = getDatabases();
    try {
      await databases.updateDocument(DB_ID, COLLECTION_ID, DOC_ID, { certificatesLive: live });
    } catch {
      await databases.createDocument(DB_ID, COLLECTION_ID, DOC_ID, { certificatesLive: live });
    }
    return NextResponse.json({ success: true, certificatesLive: live });
  } catch (error) {
    console.error('publish-certificates error:', error);
    return NextResponse.json({ error: 'Failed to update publish status' }, { status: 500 });
  }
}
