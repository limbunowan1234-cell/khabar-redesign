import { NextRequest, NextResponse } from 'next/server';
import { Client, Storage, ID } from 'node-appwrite';

// Week 38 of the Cloudflare migration (see cloudflare/README.md): the
// submission row writes to D1 through the Worker now. Photo upload stays
// on Appwrite Storage -- imageFileId is (and always was) an Appwrite file
// id, rendered via /api/image-proxy against that same bucket, so no
// display-side change is needed by leaving this part alone.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SERVICE_HEADERS = { 'X-Service-Secret': process.env.WORKER_SERVICE_SECRET || '', 'Content-Type': 'application/json' };

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

    let imageFileId: string | null = null;

    if (photoFile) {
      try {
        const client = new Client()
          .setEndpoint('https://nyc.cloud.appwrite.io/v1')
          .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'khabardarjeeling')
          .setKey(process.env.APPWRITE_API_KEY || '');
        const storage = new Storage(client);
        const buffer = await photoFile.arrayBuffer();
        const file = await storage.createFile(
          '6a67a307002f71e8dcf5',
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

    const res = await fetch(WORKER_URL + '/bhasa-diwas/submissions', {
      method: 'POST',
      headers: SERVICE_HEADERS,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        title: title.substring(0, 200),
        category,
        description: description.substring(0, 35000),
        submitterName: submitterName.substring(0, 100),
        submitterId,
        imageFileId,
      }),
    });
    if (!res.ok) {
      console.error('Worker submission create failed:', res.status, await res.text());
      throw new Error('Worker write failed');
    }
    const data = await res.json();

    return NextResponse.json({
      success: true,
      submission: data.submission,
    });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { error: 'सबमिशन असफल भयो' },
      { status: 500 }
    );
  }
}
