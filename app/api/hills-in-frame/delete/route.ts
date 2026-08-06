import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases } from 'node-appwrite';

async function checkPhotographer(jwt: string): Promise<{ ok: boolean; userId?: string; userName?: string }> {
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
    if (!labels.includes('photographer')) return { ok: false };
    return { ok: true, userId: user.$id, userName: user.name };
  } catch {
    return { ok: false };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, jwt } = await req.json();
    const auth = await checkPhotographer(jwt);
    if (!auth.ok) {
      return NextResponse.json({ error: 'Photographer access required' }, { status: 403 });
    }
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const client = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);

    const existing = await databases.getDocument('Khabar_db', 'photography', id);
    if (existing.submitterId !== auth.userId) {
      return NextResponse.json({ error: 'You can only delete your own photos' }, { status: 403 });
    }

    await databases.deleteDocument('Khabar_db', 'photography', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Photography delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}