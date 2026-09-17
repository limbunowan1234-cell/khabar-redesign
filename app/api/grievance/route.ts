import { NextRequest, NextResponse } from 'next/server';

// Grievance Redressal intake required under Rule 13 of the IT Rules, 2021
// (Level I of the three-tier mechanism: publisher -> self-regulatory body
// -> MIB oversight). Sends straight to grievance@khabardarjeeling.in via
// Resend's HTTP API, same provider and pattern as the Worker's own
// password-reset email (see cloudflare/src/lib/email.ts) -- needs
// RESEND_API_KEY set as a Vercel env var too (same value already set as
// the Worker secret).

const GRIEVANCE_EMAIL = 'grievance@khabardarjeeling.in';
const COMPLAINT_TYPES = ['Editorial', 'Platform', 'Privacy', 'Other'];

function esc(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const email = body?.email?.trim();
  const phone = body?.phone?.trim() || '';
  const complaintType = body?.complaintType;
  const articleUrl = body?.articleUrl?.trim() || '';
  const description = body?.description?.trim();
  const resolutions: string[] = Array.isArray(body?.resolutions) ? body.resolutions : [];

  if (!name || !email || !description) {
    return NextResponse.json({ error: 'Name, email, and description are required.' }, { status: 400 });
  }
  if (!COMPLAINT_TYPES.includes(complaintType)) {
    return NextResponse.json({ error: 'A valid complaint type is required.' }, { status: 400 });
  }
  if (description.length > 8000) {
    return NextResponse.json({ error: 'Description is too long (max ~1000 words).' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('grievance: RESEND_API_KEY is not set');
    return NextResponse.json({ error: 'Grievance submission is temporarily unavailable. Please email grievance@khabardarjeeling.in directly.' }, { status: 503 });
  }

  const html = `
    <h2>New Grievance Submission</h2>
    <p><strong>Name:</strong> ${esc(name)}</p>
    <p><strong>Email:</strong> ${esc(email)}</p>
    <p><strong>Phone:</strong> ${esc(phone || '(not provided)')}</p>
    <p><strong>Complaint Type:</strong> ${esc(complaintType)}</p>
    <p><strong>Article URL:</strong> ${articleUrl ? `<a href="${esc(articleUrl)}">${esc(articleUrl)}</a>` : '(not provided)'}</p>
    <p><strong>Desired Resolution:</strong> ${resolutions.length ? esc(resolutions.join(', ')) : '(none selected)'}</p>
    <p><strong>Description:</strong></p>
    <p style="white-space:pre-wrap">${esc(description)}</p>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Khabar Darjeeling Grievance Desk <noreply@khabardarjeeling.in>',
        to: [GRIEVANCE_EMAIL],
        reply_to: email,
        subject: `[Grievance: ${complaintType}] ${name}`,
        html,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('grievance: Resend send failed', res.status, errBody);
      return NextResponse.json({ error: 'Failed to submit grievance. Please try again or email grievance@khabardarjeeling.in directly.' }, { status: 502 });
    }
  } catch (err) {
    console.error('grievance: send error', err);
    return NextResponse.json({ error: 'Failed to submit grievance. Please try again or email grievance@khabardarjeeling.in directly.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
