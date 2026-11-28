import { Hono } from 'hono';
import { isAdmin, type AppUser } from '../lib/auth';
import { sniffImage } from './cdn';
import { camel, staffUser, loadCase, loadChild, eventStmt, str, oneOf, type Bindings, type Ctx, type Row } from '../lib/reunionCore';

// Family Reunion case files and consent records. Mounted under /reunion by
// src/routes/reunion.ts.
//
//  - Files live in the REUNION_PRIVATE bucket, which nothing serves publicly.
//    GET /media/:id/file streams one to the case team and writes the view to
//    the case history (at most once per person per file per 30 minutes, so a
//    gallery of thumbnails doesn't flood it).
//  - A photo becomes public only when an admin publishes it against an active
//    consent covering photos: the bytes are copied to IMAGES under
//    reunion-public/ and served by GET /public-media/:key. Withdrawing that
//    consent, unpublishing, or deleting the file removes the public copy.
//  - Withdrawing a story consent also switches the case's public page off.

export const reunionMedia = new Hono<{ Bindings: Bindings }>();

const MAX_BYTES = 15 * 1024 * 1024;
const MEDIA_KINDS = ['photo', 'document'];
const CONSENT_SCOPES = ['public_story', 'public_photo', 'both'];
const CONSENT_METHODS = ['written', 'verbal', 'whatsapp', 'email', 'other'];
const RELATIONSHIPS = ['self', 'family', 'guardian', 'other'];
const PUBLIC_PREFIX = 'reunion-public/';

// Photos (the same formats article uploads accept) and PDF documents,
// identified from the file's first bytes, never its name.
function sniffMedia(b: Uint8Array): { type: string; ext: string; kind: 'photo' | 'document' } | null {
  const img = sniffImage(b);
  if (img) return { ...img, kind: 'photo' };
  if (b.length >= 5 && String.fromCharCode(...b.subarray(0, 5)) === '%PDF-') return { type: 'application/pdf', ext: 'pdf', kind: 'document' };
  return null;
}

async function loadConsent(c: Ctx, user: AppUser, id: string): Promise<{ consent: Row; parent: Row } | null> {
  const consent = await c.env.DB.prepare('SELECT * FROM reunion_case_consents WHERE id = ?').bind(id).first<Row>();
  if (!consent) return null;
  const parent = await loadCase(c, user, consent.case_id);
  return parent ? { consent, parent } : null;
}

// Deletes a published copy and returns the statements that record it.
async function unpublishStmts(c: Ctx, user: AppUser | null, media: Row, caseRow: Row, reason: string): Promise<D1PreparedStatement[]> {
  if (!media.public_key) return [];
  await c.env.IMAGES.delete(PUBLIC_PREFIX + media.public_key);
  const stmts = [
    c.env.DB.prepare('UPDATE reunion_case_media SET public_key = NULL, consent_id = NULL WHERE id = ?').bind(media.id),
    eventStmt(c.env.DB, caseRow.id, user, { type: 'media_unpublished', entityType: 'media', entityId: media.id, oldValue: media.filename, reason }),
  ];
  if (caseRow.public_photo_media_id === media.id) {
    stmts.push(c.env.DB.prepare('UPDATE reunion_cases SET public_photo_media_id = NULL WHERE id = ?').bind(caseRow.id));
  }
  return stmts;
}

// ---- files ---------------------------------------------------------------------

// POST /reunion/cases/:id/media  multipart: file, caption?, leadId?
reunionMedia.post('/cases/:id/media', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file') as File | null;
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') return c.json({ error: 'file is required' }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: 'Files can be up to 15 MB' }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffMedia(bytes);
  if (!kind) return c.json({ error: 'Only photos (JPEG, PNG, WebP, GIF, AVIF) and PDF documents can be uploaded' }, 415);

  const leadId = str(form?.get('leadId'), 100);
  if (leadId && !(await c.env.DB.prepare('SELECT 1 FROM reunion_case_leads WHERE id = ? AND case_id = ?').bind(leadId, row.id).first())) {
    return c.json({ error: 'That lead belongs to another case' }, 400);
  }
  const id = crypto.randomUUID();
  const key = `${row.id}/${id}.${kind.ext}`;
  const filename = (file.name || `file.${kind.ext}`).replace(/[^\w.\- ()]/g, '_').slice(0, 150);
  await c.env.REUNION_PRIVATE.put(key, bytes, { httpMetadata: { contentType: kind.type } });
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO reunion_case_media (id, case_id, lead_id, kind, private_key, filename, content_type, size_bytes, caption, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, row.id, leadId ?? null, kind.kind, key, filename, kind.type, bytes.length, str(form?.get('caption'), 1000) ?? null, user.$id),
    eventStmt(c.env.DB, row.id, user, { type: 'media_added', entityType: 'media', entityId: id, newValue: filename }),
    c.env.DB.prepare("UPDATE reunion_cases SET updated_at = datetime('now') WHERE id = ?").bind(row.id),
  ]);
  return c.json(camel(await c.env.DB.prepare('SELECT * FROM reunion_case_media WHERE id = ?').bind(id).first<Row>()), 201);
});

reunionMedia.get('/cases/:id/media', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const { results } = await c.env.DB
    .prepare(
      `SELECT m.id, m.case_id, m.lead_id, m.kind, m.filename, m.content_type, m.size_bytes, m.caption, m.public_key, m.consent_id,
              m.uploaded_by, u.name AS uploaded_by_name, m.created_at
       FROM reunion_case_media m LEFT JOIN users u ON u.id = m.uploaded_by
       WHERE m.case_id = ? AND m.deleted_at IS NULL ORDER BY m.created_at DESC`
    )
    .bind(row.id)
    .all<Row>();
  return c.json({ documents: results.map(camel) });
});

// Streams a private file to the case team. Never cached by browsers or CDNs.
reunionMedia.get('/media/:id/file', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadChild(c, user, 'reunion_case_media', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const object = await c.env.REUNION_PRIVATE.get(found.child.private_key);
  if (!object) return c.json({ error: 'File missing from storage' }, 404);

  const recent = await c.env.DB
    .prepare(
      `SELECT 1 FROM reunion_case_events WHERE entity_type = 'media' AND entity_id = ? AND actor_id = ? AND event_type = 'viewed_sensitive'
       AND created_at > datetime('now', '-30 minutes') LIMIT 1`
    )
    .bind(found.child.id, user.$id)
    .first();
  if (!recent) {
    await eventStmt(c.env.DB, found.parent.id, user, { type: 'viewed_sensitive', entityType: 'media', entityId: found.child.id, newValue: found.child.filename }).run();
  }
  const headers = new Headers({
    'content-type': found.child.content_type || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, no-store',
    'content-disposition': `inline; filename="${(found.child.filename || 'file').replace(/"/g, '')}"`,
  });
  return new Response(object.body, { headers });
});

reunionMedia.patch('/media/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadChild(c, user, 'reunion_case_media', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const caption = str((await c.req.json().catch(() => null))?.caption, 1000);
  if (caption === undefined || caption === found.child.caption) return c.json({ ok: true, changed: [] });
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE reunion_case_media SET caption = ? WHERE id = ?').bind(caption, found.child.id),
    eventStmt(c.env.DB, found.parent.id, user, { type: 'media_changed', entityType: 'media', entityId: found.child.id, field: 'caption', oldValue: found.child.caption, newValue: caption }),
  ]);
  return c.json({ ok: true, changed: ['caption'] });
});

// DELETE /reunion/media/:id { reason, purge? }
// Removes the file from the case (and any public copy). An admin can also
// purge it, which deletes the private file from storage permanently.
reunionMedia.delete('/media/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadChild(c, user, 'reunion_case_media', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => null);
  const reason = str(b?.reason, 2000);
  if (!reason || reason.length < 3) return c.json({ error: 'A reason is required' }, 400);
  const purge = !!b?.purge;
  if (purge && !isAdmin(user)) return c.json({ error: 'Only an admin can permanently delete files' }, 403);

  const stmts = await unpublishStmts(c, user, found.child, found.parent, 'File removed');
  if (purge) await c.env.REUNION_PRIVATE.delete(found.child.private_key);
  stmts.push(
    c.env.DB.prepare("UPDATE reunion_case_media SET deleted_at = datetime('now') WHERE id = ?").bind(found.child.id),
    eventStmt(c.env.DB, found.parent.id, user, { type: purge ? 'media_purged' : 'media_removed', entityType: 'media', entityId: found.child.id, oldValue: found.child.filename, reason }),
  );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, purged: purge });
});

// POST /reunion/media/:id/publish { consentId }  -- admin only.
reunionMedia.post('/media/:id/publish', async (c) => {
  const user = await staffUser(c);
  if (!user || !isAdmin(user)) return c.json({ error: 'Only an admin can publish a photo' }, 403);
  const found = await loadChild(c, user, 'reunion_case_media', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const media = found.child;
  if (media.kind !== 'photo') return c.json({ error: 'Only photos can be published' }, 400);
  if (media.public_key) return c.json({ ok: true, publicKey: media.public_key });
  const consentId = str((await c.req.json().catch(() => null))?.consentId, 100);
  const consent = consentId
    ? await c.env.DB.prepare('SELECT * FROM reunion_case_consents WHERE id = ? AND case_id = ?').bind(consentId, found.parent.id).first<Row>()
    : null;
  if (!consent || consent.withdrawn_at || !['public_photo', 'both'].includes(consent.scope)) {
    return c.json({ error: 'Choose an active consent that covers public photos' }, 400);
  }
  const object = await c.env.REUNION_PRIVATE.get(media.private_key);
  if (!object) return c.json({ error: 'File missing from storage' }, 404);
  const publicKey = crypto.randomUUID() + '.' + (media.private_key.split('.').pop() || 'jpg');
  await c.env.IMAGES.put(PUBLIC_PREFIX + publicKey, await object.arrayBuffer(), { httpMetadata: { contentType: media.content_type || 'image/jpeg' } });
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE reunion_case_media SET public_key = ?, consent_id = ? WHERE id = ?').bind(publicKey, consent.id, media.id),
    eventStmt(c.env.DB, found.parent.id, user, {
      type: 'media_published', entityType: 'media', entityId: media.id, newValue: media.filename, note: `Consent from ${consent.given_by} (${consent.scope}, ${consent.method})`,
    }),
  ]);
  return c.json({ ok: true, publicKey });
});

reunionMedia.post('/media/:id/unpublish', async (c) => {
  const user = await staffUser(c);
  if (!user || !isAdmin(user)) return c.json({ error: 'Only an admin can unpublish a photo' }, 403);
  const found = await loadChild(c, user, 'reunion_case_media', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const reason = str((await c.req.json().catch(() => null))?.reason, 2000) || 'Unpublished by admin';
  const stmts = await unpublishStmts(c, user, found.child, found.parent, reason);
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// Public: a published photo. Served only while its file and case still exist.
reunionMedia.get('/public-media/:key', async (c) => {
  const key = c.req.param('key');
  if (!/^[\w-]+\.\w+$/.test(key)) return c.notFound();
  const live = await c.env.DB
    .prepare(
      `SELECT 1 FROM reunion_case_media m JOIN reunion_cases rc ON rc.id = m.case_id
       WHERE m.public_key = ? AND m.deleted_at IS NULL AND rc.deleted_at IS NULL`
    )
    .bind(key)
    .first();
  if (!live) return c.notFound();
  const object = await c.env.IMAGES.get(PUBLIC_PREFIX + key);
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('x-content-type-options', 'nosniff');
  // Short cache so withdrawing consent takes effect quickly everywhere.
  headers.set('cache-control', 'public, max-age=300');
  return new Response(object.body, { headers });
});

// ---- consents ---------------------------------------------------------------------

reunionMedia.get('/cases/:id/consents', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const { results } = await c.env.DB
    .prepare(
      `SELECT k.*, u.name AS recorded_by_name FROM reunion_case_consents k LEFT JOIN users u ON u.id = k.recorded_by
       WHERE k.case_id = ? ORDER BY k.withdrawn_at IS NOT NULL, k.given_at DESC`
    )
    .bind(row.id)
    .all<Row>();
  return c.json({ documents: results.map(camel) });
});

// POST /reunion/cases/:id/consents { givenBy, relationship, scope, method, givenAt, notes }
reunionMedia.post('/cases/:id/consents', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => null);
  const givenBy = str(b?.givenBy, 200);
  const scope = oneOf(b?.scope, CONSENT_SCOPES);
  const givenAt = str(b?.givenAt, 40);
  if (!givenBy || !scope || !givenAt) return c.json({ error: 'givenBy, scope and givenAt are required' }, 400);
  const id = crypto.randomUUID();
  const method = oneOf(b?.method, CONSENT_METHODS) || 'written';
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO reunion_case_consents (id, case_id, given_by, relationship, scope, method, given_at, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, row.id, givenBy, oneOf(b?.relationship, RELATIONSHIPS) || 'self', scope, method, givenAt, str(b?.notes, 2000) ?? null, user.$id),
    eventStmt(c.env.DB, row.id, user, { type: 'consent_recorded', entityType: 'consent', entityId: id, newValue: `${givenBy}: ${scope} (${method}, ${givenAt})` }),
  ]);
  return c.json(camel(await c.env.DB.prepare('SELECT * FROM reunion_case_consents WHERE id = ?').bind(id).first<Row>()), 201);
});

// POST /reunion/consents/:id/withdraw { reason }
// Any team member can act on a withdrawal straight away: public copies of
// photos published under this consent are deleted, and if it covered the
// story and no other story consent is active, the public page is switched off.
reunionMedia.post('/consents/:id/withdraw', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadConsent(c, user, c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const { consent, parent } = found;
  if (consent.withdrawn_at) return c.json({ ok: true, alreadyWithdrawn: true });
  const reason = str((await c.req.json().catch(() => null))?.reason, 2000);
  if (!reason) return c.json({ error: 'A reason is required' }, 400);

  const stmts: D1PreparedStatement[] = [
    c.env.DB.prepare("UPDATE reunion_case_consents SET withdrawn_at = datetime('now') WHERE id = ?").bind(consent.id),
    eventStmt(c.env.DB, parent.id, user, { type: 'consent_withdrawn', entityType: 'consent', entityId: consent.id, oldValue: `${consent.given_by}: ${consent.scope}`, reason }),
  ];
  const { results: published } = await c.env.DB
    .prepare('SELECT * FROM reunion_case_media WHERE consent_id = ? AND public_key IS NOT NULL').bind(consent.id).all<Row>();
  for (const m of published) stmts.push(...(await unpublishStmts(c, user, m, parent, 'Consent withdrawn')));

  let pageOff = false;
  if (['public_story', 'both'].includes(consent.scope) && parent.public_enabled) {
    const other = await c.env.DB
      .prepare("SELECT 1 FROM reunion_case_consents WHERE case_id = ? AND id <> ? AND withdrawn_at IS NULL AND scope IN ('public_story', 'both') LIMIT 1")
      .bind(parent.id, consent.id).first();
    if (!other) {
      pageOff = true;
      stmts.push(
        c.env.DB.prepare("UPDATE reunion_cases SET public_enabled = 0, updated_at = datetime('now') WHERE id = ?").bind(parent.id),
        eventStmt(c.env.DB, parent.id, user, { type: 'case_changed', entityType: 'case', entityId: parent.id, field: 'publicEnabled', oldValue: 1, newValue: 0, reason: 'Story consent withdrawn' }),
      );
    }
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, unpublishedPhotos: published.length, publicPageSwitchedOff: pageOff });
});
