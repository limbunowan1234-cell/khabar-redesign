import { NextRequest, NextResponse } from 'next/server';

// Week 38 of the Cloudflare migration (see cloudflare/README.md): the
// submission row writes to D1 through the Worker now. Week 40: photo
// upload moves off Appwrite Storage too, onto R2 via the Worker's
// service-secret-gated POST /cdn/bhasa-diwas -- unlike article images,
// this bucket (6a67a307002f71e8dcf5) never had an R2 mirror at all, so
// this closes a real gap rather than replacing a redundant path.
// imageFileId is now an R2 key rendered via /cdn/bhasa-diwas/<key>, not
// an Appwrite file id -- see app/nepali-bhasa-diwas/[id]/page.tsx.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';
const SERVICE_SECRET_HEADER = { 'X-Service-Secret': process.env.WORKER_SERVICE_SECRET || '' };
const SERVICE_HEADERS = { ...SERVICE_SECRET_HEADER, 'Content-Type': 'application/json' };

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
        const uploadForm = new FormData();
        uploadForm.append('file', photoFile);
        const uploadRes = await fetch(WORKER_URL + '/cdn/bhasa-diwas', {
          method: 'POST',
          headers: SERVICE_SECRET_HEADER,
          body: uploadForm,
        });
        if (!uploadRes.ok) throw new Error('Worker upload failed: ' + uploadRes.status);
        const uploadData = await uploadRes.json();
        imageFileId = uploadData.fileId;
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
