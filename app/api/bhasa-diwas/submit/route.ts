import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Storage, ID } from 'node-appwrite';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const title = formData.get('title') as string;
    const category = formData.get('category') as string;
    const description = formData.get('description') as string;
    const submitterName = formData.get('submitterName') as string;
    const submitterId = formData.get('submitterId') as string;
    const photoFile = formData.get('photo') as File | null;

    if (!title || !category || !description || !submitterName || !submitterId) {
      return NextResponse.json(
        { error: 'सबै क्षेत्र आवश्यक छन्' },
        { status: 400 }
      );
    }

    if (!['poetry', 'essay', 'photo'].includes(category)) {
      return NextResponse.json(
        { error: 'अमान्य वर्ग' },
        { status: 400 }
      );
    }

    if (category === 'photo' && !photoFile) {
      return NextResponse.json(
        { error: 'फोटो वर्गको लागि चित्र आवश्यक छ' },
        { status: 400 }
      );
    }

    const client = new Client()
      .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://api.khabardarjeeling.in/v1')
      .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
      .setKey(process.env.APPWRITE_API_KEY || '');

    const databases = new Databases(client);
    const storage = new Storage(client);

    let imageFileId: string | null = null;

    if (photoFile) {
      try {
        const buffer = await photoFile.arrayBuffer();
        const file = await storage.createFile(
          'bhasadiwas-photos',
          ID.unique(),
          new File([buffer], photoFile.name, { type: photoFile.type })
        );
        imageFileId = file.$id;
      } catch (error) {
        console.error('Photo upload failed:', error);
        return NextResponse.json(
          { error: 'चित्र अपलोड असफल' },
          { status: 500 }
        );
      }
    }

    // Retry loop: if document ID collision happens for any reason
    // (duplicate request, replay, network retry), generate a fresh
    // unique ID and try again, up to 3 attempts.
    let submission = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        submission = await databases.createDocument(
          'Khabar_db',
          'bhasa_diwas_submissions',
          ID.unique(),
          {
            title: title.substring(0, 200),
            category,
            description: description.substring(0, 2000),
            submitterName: submitterName.substring(0, 100),
            submitterId,
            imageFileId: imageFileId || null,
            votes: 0
          }
        );
        break;
      } catch (err: any) {
        lastError = err;
        if (err?.code === 409) {
          console.warn(`ID collision on attempt ${attempt + 1}, retrying with new ID...`);
          continue;
        }
        throw err;
      }
    }

    if (!submission) {
      throw lastError;
    }

    return NextResponse.json({
      success: true,
      submission: submission
    });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { error: 'सबमिशन असफल भयो' },
      { status: 500 }
    );
  }
}