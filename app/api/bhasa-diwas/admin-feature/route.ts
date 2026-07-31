import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases } from 'node-appwrite';

const ADMIN_EMAIL = 'nowanad@gmail.com';

async function checkAdmin(req: NextRequest): Promise<boolean> {
  const cookieHeader = req.headers.get('cookie') || '';
  try {
    const res = await fetch('https://nyc.cloud.appwrite.io/v1/account', {
      headers: {
        'X-Appwrite-Project': 'khabardarjeeling',
        'cookie': cookieHeader
      }
    });
    if (!res.ok) return false;
    const user = await res.json();
    return user.email?.toLowerCase() === ADMIN_EMAIL || (user.labels || []).includes('admin');
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await checkAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { id, isFeatured } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const adminClient = new Client()
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(adminClient);

    await databases.updateDocument('Khabar_db', 'bhasa_diwas_submissions', id, { isFeatured: !!isFeatured });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin feature toggle error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}