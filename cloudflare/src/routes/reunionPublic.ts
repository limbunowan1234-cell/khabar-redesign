import { Hono } from 'hono';
import { sniffImage } from './cdn';
import { eventStmt, str, type Bindings, type Row } from '../lib/reunionCore';

// Public side of Family Reunion cases. Mounted under /reunion by
// src/routes/reunion.ts. No login.
//
//  GET  /public/:code        the appeal page's data. Only for a case an admin
//                            switched public, with an active story consent,
//                            and only what was explicitly approved: the public
//                            headline/story, facts marked public, the published
//                            photo and published articles. Never contacts,
//                            leads, internal notes or private files.
//  POST /public/:code/leads  "Submit information". Goes into the case's lead
//                            inbox as New for the team to review; nothing is
//                            ever published from it. Spam protection: Cloudflare
//                            Turnstile, a hidden honeypot field, and at most
//                            SUBMISSIONS_PER_DAY per (hashed) IP address.

export const reunionPublic = new Hono<{ Bindings: Bindings }>();

const SUBMISSIONS_PER_DAY = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PROVENANCE_PUBLIC: Record<string, string> = {
  verified: 'Verified by Khabar Darjeeling',
  source_provided: 'As remembered by the family',
  unverified: 'Not yet confirmed',
  disputed: 'Being checked',
};

// A case is public only while an admin has it switched on AND a story
// consent is active (withdrawal switches it off too; this is a second lock).
async function publicCase(db: D1Database, code: string): Promise<Row | null> {
  return db
    .prepare(
      `SELECT rc.* FROM reunion_cases rc
       WHERE rc.case_code = ? AND rc.public_enabled = 1 AND rc.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM reunion_case_consents k WHERE k.case_id = rc.id AND k.withdrawn_at IS NULL AND k.scope IN ('public_story', 'both'))`
    )
    .bind(code.toUpperCase())
    .first<Row>();
}

reunionPublic.get('/public/:code', async (c) => {
  const row = await publicCase(c.env.DB, c.req.param('code'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const [facts, photo, articles] = await Promise.all([
    c.env.DB
      .prepare('SELECT section, label, value, provenance FROM reunion_case_facts WHERE case_id = ? AND is_public = 1 AND deleted_at IS NULL ORDER BY sort_order, created_at')
      .bind(row.id).all<Row>(),
    row.public_photo_media_id
      ? c.env.DB.prepare('SELECT public_key, caption FROM reunion_case_media WHERE id = ? AND public_key IS NOT NULL AND deleted_at IS NULL').bind(row.public_photo_media_id).first<Row>()
      : null,
    c.env.DB
      .prepare("SELECT title, side_header, slug, published_at, image_file_id FROM articles WHERE reunion_case_id = ? AND status = 'published' ORDER BY published_at DESC")
      .bind(row.id).all<Row>(),
  ]);
  const res = c.json({
    caseCode: row.case_code,
    headline: row.public_headline || row.title,
    story: row.public_story,
    photo: photo ? { key: photo.public_key, caption: photo.caption } : null,
    facts: facts.results.map((f) => ({ section: f.section, label: f.label, value: f.value, status: PROVENANCE_PUBLIC[f.provenance] || PROVENANCE_PUBLIC.unverified, verified: f.provenance === 'verified' })),
    updates: articles.results.map((a) => ({ title: a.title, sideHeader: a.side_header, slug: a.slug, publishedAt: a.published_at, imageFileId: a.image_file_id })),
    resolved: ['family_located', 'contact_established', 'reunion_arranged', 'successfully_reunited'].includes(row.status),
  });
  // Short cache: unpublishing or withdrawing consent must take effect quickly.
  res.headers.set('cache-control', 'public, max-age=60');
  return res;
});

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function turnstileOk(secret: string, token: string, ip: string | null): Promise<boolean> {
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const json = (await res.json()) as { success?: boolean };
    return !!json.success;
  } catch {
    return false;
  }
}

// POST /reunion/public/:code/leads  multipart:
//   name, phone, email?, information, recognition?, consent ("yes"),
//   cf-turnstile-response, website (honeypot, must be empty), file?
reunionPublic.post('/public/:code/leads', async (c) => {
  const row = await publicCase(c.env.DB, c.req.param('code'));
  if (!row) return c.json({ error: 'This appeal is not open for submissions' }, 404);
  if (!c.env.TURNSTILE_SECRET) {
    console.error('reunion public form: TURNSTILE_SECRET is not set');
    return c.json({ error: 'The form is not available right now. Please message the Khabar Darjeeling page instead.' }, 503);
  }
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: 'Invalid form' }, 400);

  // Bots that fill every field get a quiet success and nothing is stored.
  if (String(form.get('website') || '').trim()) return c.json({ ok: true, reference: 'KD-' + crypto.randomUUID().slice(0, 6).toUpperCase() });

  const name = str(form.get('name'), 200);
  const phone = str(form.get('phone'), 40);
  const email = str(form.get('email'), 200);
  const information = str(form.get('information'), 5000);
  const recognition = str(form.get('recognition'), 2000);
  if (!name || !phone || !information) return c.json({ error: 'Please give your name, a contact number and the information you have.' }, 400);
  if (information.length < 20) return c.json({ error: 'Please tell us a little more (at least 20 characters).' }, 400);
  if (!/^[+\d][\d\s()-]{6,}$/.test(phone)) return c.json({ error: 'Please enter a valid contact number.' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Please enter a valid email address, or leave it empty.' }, 400);
  if (form.get('consent') !== 'yes') return c.json({ error: 'Please confirm the consent statement.' }, 400);

  const ip = c.req.header('CF-Connecting-IP') || null;
  if (!(await turnstileOk(c.env.TURNSTILE_SECRET, String(form.get('cf-turnstile-response') || ''), ip))) {
    return c.json({ error: 'Please complete the security check and try again.' }, 400);
  }

  // Rate limit per hashed IP per day (the raw IP is never stored).
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = await sha256((ip || 'unknown') + '|' + c.env.AUTH_JWT_SECRET);
  const used = await c.env.DB.prepare('SELECT count FROM reunion_submission_limits WHERE ip_hash = ? AND day = ?').bind(ipHash, day).first<{ count: number }>();
  if ((used?.count || 0) >= SUBMISSIONS_PER_DAY) {
    return c.json({ error: 'You have sent several messages today. Please try again tomorrow or message the Khabar Darjeeling page.' }, 429);
  }

  // Optional photo or PDF, kept private with the lead.
  let fileRow: { key: string; bytes: Uint8Array; type: string; kind: string; name: string } | null = null;
  const file = form.get('file') as File | string | null;
  if (file && typeof file !== 'string' && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return c.json({ error: 'The attachment can be up to 10 MB.' }, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const img = sniffImage(bytes);
    const pdf = !img && bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
    if (!img && !pdf) return c.json({ error: 'Attachments can be a photo or a PDF.' }, 415);
    const ext = img ? img.ext : 'pdf';
    fileRow = { key: `${row.id}/${crypto.randomUUID()}.${ext}`, bytes, type: img ? img.type : 'application/pdf', kind: img ? 'photo' : 'document', name: (file.name || 'attachment').replace(/[^\w.\- ()]/g, '_').slice(0, 150) };
  }

  const leadId = crypto.randomUUID();
  const reference = 'KD-' + leadId.slice(0, 6).toUpperCase();
  const stmts: D1PreparedStatement[] = [
    c.env.DB
      .prepare(
        `INSERT INTO reunion_case_leads (id, case_id, source_type, provider_name, provider_contact, provider_email, original_message, recognition, summary, consent_given)
         VALUES (?, ?, 'public_form', ?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(leadId, row.id, name, phone, email ?? null, information, recognition ?? null, `Public form ${reference}`),
    c.env.DB
      .prepare('INSERT INTO reunion_submission_limits (ip_hash, day, count) VALUES (?, ?, 1) ON CONFLICT (ip_hash, day) DO UPDATE SET count = count + 1')
      .bind(ipHash, day),
    c.env.DB.prepare("DELETE FROM reunion_submission_limits WHERE day < date('now', '-3 days')"),
    eventStmt(c.env.DB, row.id, null, { type: 'lead_added', entityType: 'lead', entityId: leadId, newValue: `Public form submission ${reference}`, note: null }),
    c.env.DB.prepare("UPDATE reunion_cases SET updated_at = datetime('now') WHERE id = ?").bind(row.id),
  ];
  if (fileRow) {
    await c.env.REUNION_PRIVATE.put(fileRow.key, fileRow.bytes, { httpMetadata: { contentType: fileRow.type } });
    stmts.push(
      c.env.DB
        .prepare(
          `INSERT INTO reunion_case_media (id, case_id, lead_id, kind, private_key, filename, content_type, size_bytes, caption)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(crypto.randomUUID(), row.id, leadId, fileRow.kind, fileRow.key, fileRow.name, fileRow.type, fileRow.bytes.length, `Sent with public submission ${reference}`)
    );
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, reference });
});
