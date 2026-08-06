import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Permission, Role } from 'node-appwrite';

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
    const { title, caption, location, imageFileId, jwt } = await req.json();
    const auth = await checkPhotographer(jwt);
    if (!auth.ok) {
      return NextResponse.json({ error: 'Photographer access required' }, { status: 403 });
    }
    if (!title || !caption || !imageFileId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);

    const doc = await databases.createDocument('Khabar_db', 'photography', 'unique()', {
      title: title.trim(),
      caption: caption.trim(),
      location: location ? location.trim() : null,
      imageFileId,
      submitterId: auth.userId,
      submitterName: auth.userName || 'Photographer'
    }, [Permission.read(Role.any())]);

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    console.error('Photography create error:', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
