import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Storage, ID } from 'node-appwrite';
import { randomBytes } from 'crypto';

function generateManualId(): string {
  // Appwrite IDs must be <= 36 chars, alphanumeric + underscore/hyphen,
  // and cannot start with a special character. Generate a safe 20-char
  // hex string prefixed with a letter to guarantee validity.
  return 'm' + randomBytes(10).toString('hex');
}

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
      .setEndpoint('https://nyc.cloud.appwrite.io/v1')
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

    let submission = null;
    let lastError: any = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const newId = generateManualId();
      console.log(`Attempt ${attempt + 1}: trying manual ID ${newId}`);
      try {
        submission = await databases.createDocument(
          'Khabar_db',
          'bhasa_diwas_submissions',
          newId,
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
        console.log(`Success on attempt ${attempt + 1} with ID ${newId}`);
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`Attempt ${attempt + 1} failed for ID ${newId}: code=${err?.code}, message=${err?.message}`);
        if (err?.code === 409) {
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