import { Hono } from 'hono';
import { isAdmin, type AppUser } from '../lib/auth';
import {
  camel, staffUser, loadCase, loadChild, visibleSql, eventStmt, str, oneOf, bool, diffUpdate, staffExists,
  type Bindings, type Ctx, type Row, type FieldSpec,
  STATUSES, ADMIN_STATUSES, ACTIVE_STATUSES, CATEGORIES, CONFIDENTIALITY, FACT_SECTIONS, PROVENANCE,
  LEAD_STATUSES, SOURCE_TYPES, CONTACT_ROLES, CASE_CODE,
} from '../lib/reunionCore';
import { reunionMedia } from './reunionMedia';
import { reunionNews } from './reunionNews';

// Family Reunion case management (KD-FR-xxx). Everything here is staff-only
// (admins + the "reunion" label) unless marked otherwise. Tables:
// db/migrations/2026-11-28-reunion-cases.sql.
//
// Rules this file enforces, since D1 has no row-level security of its own:
//  - A "restricted" case is visible only to admins and to whoever created it
//    or is assigned to it. Every case lookup goes through loadCase().
//  - Nothing is overwritten silently: each change writes a row to
//    reunion_case_events (append-only, see the migration's trigger) with the
//    old and new value. Contact details are logged as "[changed]", never
//    copied into the history.
//  - Outcome statuses (family located, reunited...) and anything that makes a
//    case public need an admin, with a recorded reason for status changes.
//  - Names and spellings are stored exactly as entered; nothing is corrected.

export const reunion = new Hono<{ Bindings: Bindings }>();

// Case files and consent records: src/routes/reunionMedia.ts.
reunion.route('/', reunionMedia);
// Case-linked articles and AI drafts: src/routes/reunionNews.ts.
reunion.route('/', reunionNews);

// ---- reference data ----------------------------------------------------------

reunion.get('/meta', async (c) => {
  if (!(await staffUser(c))) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({
    statuses: STATUSES, adminStatuses: [...ADMIN_STATUSES], categories: CATEGORIES, confidentiality: CONFIDENTIALITY,
    factSections: FACT_SECTIONS, provenance: PROVENANCE, leadStatuses: LEAD_STATUSES, sourceTypes: SOURCE_TYPES, contactRoles: CONTACT_ROLES,
  });
});

// People a case can be assigned to: admins and the reunion team.
reunion.get('/team', async (c) => {
  if (!(await staffUser(c))) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB
    .prepare(
      `SELECT id, name FROM users WHERE labels LIKE '%"admin"%' OR labels LIKE '%"reunion"%' OR lower(email) = 'nowanad@gmail.com' ORDER BY name`
    )
    .all<Row>();
  return c.json({ documents: results.map((r) => ({ $id: r.id, name: r.name })) });
});

// ---- dashboard -------------------------------------------------------------

reunion.get('/stats', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const v = visibleSql(user);
  const act = ACTIVE_STATUSES.map(() => '?').join(',');
  const row = await c.env.DB
    .prepare(
      `SELECT
         SUM(CASE WHEN rc.status <> 'archived' THEN 1 ELSE 0 END) AS total,
         SUM(CASE WHEN rc.status IN (${act}) THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN rc.status = 'verification_pending' THEN 1 ELSE 0 END) AS awaiting_verification,
         SUM(CASE WHEN rc.status = 'public_appeal_ready' THEN 1 ELSE 0 END) AS awaiting_appeal,
         SUM(CASE WHEN EXISTS (SELECT 1 FROM reunion_case_leads l WHERE l.case_id = rc.id AND l.status = 'new' AND l.deleted_at IS NULL) THEN 1 ELSE 0 END) AS with_new_leads,
         SUM(CASE WHEN rc.status = 'successfully_reunited' THEN 1 ELSE 0 END) AS reunited,
         SUM(CASE WHEN rc.status = 'archived' THEN 1 ELSE 0 END) AS archived
       FROM reunion_cases rc WHERE rc.deleted_at IS NULL AND ${v.sql}`
    )
    .bind(...ACTIVE_STATUSES, ...v.params)
    .first<Row>();
  const out: Row = {};
  for (const [k, val] of Object.entries(row || {})) out[k.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase())] = Number(val) || 0;
  return c.json(out);
});

// ---- cases -----------------------------------------------------------------

// GET /reunion/cases?status=&category=&q=&archived=1
reunion.get('/cases', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const q = c.req.query();
  const v = visibleSql(user);
  const where = ['rc.deleted_at IS NULL', v.sql];
  const params: unknown[] = [...v.params];
  if (q.status && (STATUSES as readonly string[]).includes(q.status)) { where.push('rc.status = ?'); params.push(q.status); }
  else if (!q.archived) where.push("rc.status <> 'archived'");
  if (q.category && CATEGORIES.includes(q.category)) { where.push('rc.category = ?'); params.push(q.category); }
  if (q.q) {
    const like = '%' + q.q.trim().slice(0, 100).replace(/[%_]/g, '') + '%';
    where.push('(rc.case_code LIKE ? OR rc.title LIKE ? OR rc.subject_name LIKE ?)');
    params.push(like, like, like);
  }
  const { results } = await c.env.DB
    .prepare(
      `SELECT rc.id, rc.case_code, rc.title, rc.subject_name, rc.category, rc.status, rc.confidentiality,
              rc.original_location, rc.current_location, rc.assigned_to, u.name AS assigned_name,
              rc.public_enabled, rc.created_at, rc.updated_at,
              (SELECT COUNT(*) FROM reunion_case_leads l WHERE l.case_id = rc.id AND l.status = 'new' AND l.deleted_at IS NULL) AS new_leads
       FROM reunion_cases rc LEFT JOIN users u ON u.id = rc.assigned_to
       WHERE ${where.join(' AND ')} ORDER BY rc.updated_at DESC LIMIT 200`
    )
    .bind(...params)
    .all<Row>();
  return c.json({ documents: results.map(camel) });
});

async function nextCaseCode(db: D1Database): Promise<string> {
  const row = await db
    .prepare("SELECT MAX(CAST(SUBSTR(case_code, 7) AS INTEGER)) AS n FROM reunion_cases WHERE case_code LIKE 'KD-FR-%'")
    .first<{ n: number | null }>();
  return 'KD-FR-' + String((row?.n || 0) + 1).padStart(3, '0');
}

reunion.post('/cases', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  const title = str(b?.title, 300);
  if (!title) return c.json({ error: 'title is required' }, 400);

  let code: string;
  if (b?.caseCode !== undefined) {
    code = String(b.caseCode).trim().toUpperCase();
    if (!CASE_CODE.test(code)) return c.json({ error: 'caseCode must look like KD-FR-001' }, 400);
    if (await c.env.DB.prepare('SELECT 1 FROM reunion_cases WHERE case_code = ?').bind(code).first()) {
      return c.json({ error: `${code} already exists` }, 409);
    }
  } else code = await nextCaseCode(c.env.DB);

  const assignedTo = str(b?.assignedTo, 100);
  if (assignedTo && !(await staffExists(c.env.DB, assignedTo))) return c.json({ error: 'assignedTo is not a known user' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO reunion_cases (id, case_code, title, subject_name, category, confidentiality, original_location, current_location, description, assigned_to, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, code, title, str(b?.subjectName, 200) ?? null, oneOf(b?.category, CATEGORIES) || 'family_reconnection',
        oneOf(b?.confidentiality, CONFIDENTIALITY) || 'standard', str(b?.originalLocation, 300) ?? null,
        str(b?.currentLocation, 300) ?? null, str(b?.description, 20000) ?? null, assignedTo ?? null, user.$id, user.$id),
    eventStmt(c.env.DB, id, user, { type: 'case_created', entityType: 'case', entityId: id, newValue: code }),
  ]);
  return c.json(camel(await c.env.DB.prepare('SELECT * FROM reunion_cases WHERE id = ?').bind(id).first<Row>()), 201);
});

// Case overview: the case, its facts and counts for the workspace tabs.
reunion.get('/cases/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const db = c.env.DB;
  const [facts, counts, assigned] = await Promise.all([
    db.prepare('SELECT * FROM reunion_case_facts WHERE case_id = ? AND deleted_at IS NULL ORDER BY section, sort_order, created_at').bind(row.id).all<Row>(),
    db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM reunion_case_leads WHERE case_id = ?1 AND deleted_at IS NULL) AS leads,
           (SELECT COUNT(*) FROM reunion_case_leads WHERE case_id = ?1 AND status = 'new' AND deleted_at IS NULL) AS new_leads,
           (SELECT COUNT(*) FROM reunion_case_contacts WHERE case_id = ?1 AND deleted_at IS NULL) AS contacts,
           (SELECT COUNT(*) FROM reunion_case_media WHERE case_id = ?1 AND deleted_at IS NULL) AS media,
           (SELECT COUNT(*) FROM articles WHERE reunion_case_id = ?1) AS articles,
           (SELECT COUNT(*) FROM reunion_case_consents WHERE case_id = ?1 AND withdrawn_at IS NULL) AS active_consents`
      )
      .bind(row.id)
      .first<Row>(),
    row.assigned_to ? db.prepare('SELECT name FROM users WHERE id = ?').bind(row.assigned_to).first<Row>() : null,
  ]);
  return c.json({ ...camel(row), assignedName: assigned?.name || null, facts: facts.results.map(camel), counts: camel({ id: row.id, ...counts }) });
});

const CASE_FIELDS: Record<string, FieldSpec> = {
  title: { col: 'title', parse: (v) => str(v, 300) || undefined },
  subjectName: { col: 'subject_name', parse: (v) => str(v, 200) },
  category: { col: 'category', parse: (v) => oneOf(v, CATEGORIES) },
  confidentiality: { col: 'confidentiality', parse: (v) => oneOf(v, CONFIDENTIALITY), adminOnly: true },
  originalLocation: { col: 'original_location', parse: (v) => str(v, 300) },
  currentLocation: { col: 'current_location', parse: (v) => str(v, 300) },
  description: { col: 'description', parse: (v) => str(v, 20000) },
  assignedTo: { col: 'assigned_to', parse: (v) => str(v, 100) },
  publicEnabled: { col: 'public_enabled', parse: bool, adminOnly: true },
  publicHeadline: { col: 'public_headline', parse: (v) => str(v, 300) },
  publicStory: { col: 'public_story', parse: (v) => str(v, 20000) },
  publicPhotoMediaId: { col: 'public_photo_media_id', parse: (v) => str(v, 100), adminOnly: true },
};

reunion.patch('/cases/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  if (!b) return c.json({ error: 'Body required' }, 400);
  if (b.assignedTo && !(await staffExists(c.env.DB, String(b.assignedTo)))) return c.json({ error: 'assignedTo is not a known user' }, 400);
  if (b.publicPhotoMediaId) {
    const ok = await c.env.DB
      .prepare('SELECT 1 FROM reunion_case_media WHERE id = ? AND case_id = ? AND public_key IS NOT NULL AND deleted_at IS NULL')
      .bind(String(b.publicPhotoMediaId), row.id).first();
    if (!ok) return c.json({ error: 'That photo has not been published with consent' }, 400);
  }
  const { stmts, changed, forbidden } = diffUpdate(c.env.DB, 'reunion_cases', row, b, CASE_FIELDS, user, row.id, 'case');
  if (forbidden.length) return c.json({ error: 'Only an admin can change: ' + forbidden.join(', ') }, 403);
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true, changed });
});

// POST /reunion/cases/:id/status { status, reason }
reunion.post('/cases/:id/status', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  const status = oneOf(b?.status, STATUSES);
  const reason = str(b?.reason, 2000);
  if (!status) return c.json({ error: 'A valid status is required' }, 400);
  if (!reason || reason.length < 3) return c.json({ error: 'A reason is required for every status change' }, 400);
  if (ADMIN_STATUSES.has(status) && !isAdmin(user)) return c.json({ error: 'Only an admin can set this status' }, 403);
  if (status === row.status) return c.json({ ok: true, unchanged: true });
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE reunion_cases SET status = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?").bind(status, user.$id, row.id),
    eventStmt(c.env.DB, row.id, user, { type: 'status_changed', entityType: 'case', entityId: row.id, field: 'status', oldValue: row.status, newValue: status, reason }),
  ]);
  return c.json({ ok: true, status });
});

// Soft delete, admin only. The case and its history stay in the database.
reunion.delete('/cases/:id', async (c) => {
  const user = await staffUser(c);
  if (!user || !isAdmin(user)) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const reason = str((await c.req.json().catch(() => null))?.reason, 2000);
  if (!reason) return c.json({ error: 'A reason is required' }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE reunion_cases SET deleted_at = datetime('now'), public_enabled = 0, updated_by = ? WHERE id = ?").bind(user.$id, row.id),
    eventStmt(c.env.DB, row.id, user, { type: 'case_deleted', entityType: 'case', entityId: row.id, reason }),
  ]);
  return c.json({ ok: true });
});

// ---- investigation updates and timeline ---------------------------------------

// "Add Update": a free-text investigation note on the timeline.
reunion.post('/cases/:id/updates', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const note = str((await c.req.json().catch(() => null))?.note, 10000);
  if (!note) return c.json({ error: 'note is required' }, 400);
  await c.env.DB.batch([
    eventStmt(c.env.DB, row.id, user, { type: 'update', entityType: 'case', entityId: row.id, note }),
    c.env.DB.prepare("UPDATE reunion_cases SET updated_by = ?, updated_at = datetime('now') WHERE id = ?").bind(user.$id, row.id),
  ]);
  return c.json({ ok: true }, 201);
});

reunion.get('/cases/:id/events', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const limit = Math.min(parseInt(c.req.query('limit') || '200', 10) || 200, 1000);
  const { results } = await c.env.DB
    .prepare('SELECT * FROM reunion_case_events WHERE case_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?')
    .bind(row.id, limit)
    .all<Row>();
  return c.json({ documents: results.map(camel) });
});

// ---- facts (names, family details, clues) ------------------------------------

const FACT_FIELDS: Record<string, FieldSpec> = {
  section: { col: 'section', parse: (v) => oneOf(v, FACT_SECTIONS) },
  label: { col: 'label', parse: (v) => str(v, 200) || undefined },
  value: { col: 'value', parse: (v) => str(v, 5000) || undefined },
  provenance: { col: 'provenance', parse: (v) => oneOf(v, PROVENANCE) },
  isPublic: { col: 'is_public', parse: bool },
  sortOrder: { col: 'sort_order', parse: (v) => (Number.isInteger(v) ? v : undefined) },
  notes: { col: 'notes', parse: (v) => str(v, 5000) },
};

reunion.post('/cases/:id/facts', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  const label = str(b?.label, 200);
  const value = str(b?.value, 5000);
  if (!label || !value) return c.json({ error: 'label and value are required' }, 400);
  const id = crypto.randomUUID();
  const provenance = oneOf(b?.provenance, PROVENANCE) || 'source_provided';
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO reunion_case_facts (id, case_id, section, label, value, provenance, is_public, sort_order, notes, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, row.id, oneOf(b?.section, FACT_SECTIONS) || 'clue', label, value, provenance, b?.isPublic ? 1 : 0,
        Number.isInteger(b?.sortOrder) ? b!.sortOrder : 0, str(b?.notes, 5000) ?? null, user.$id, user.$id),
    eventStmt(c.env.DB, row.id, user, { type: 'fact_added', entityType: 'fact', entityId: id, field: label, newValue: `${value} (${provenance})` }),
    c.env.DB.prepare("UPDATE reunion_cases SET updated_at = datetime('now') WHERE id = ?").bind(row.id),
  ]);
  return c.json(camel(await c.env.DB.prepare('SELECT * FROM reunion_case_facts WHERE id = ?').bind(id).first<Row>()), 201);
});


reunion.patch('/facts/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadChild(c, user, 'reunion_case_facts', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  if (!b) return c.json({ error: 'Body required' }, 400);
  const { stmts, changed } = diffUpdate(c.env.DB, 'reunion_case_facts', found.child, b, FACT_FIELDS, user, found.parent.id, 'fact');
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true, changed });
});

reunion.delete('/facts/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadChild(c, user, 'reunion_case_facts', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const reason = str((await c.req.json().catch(() => null))?.reason, 2000);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE reunion_case_facts SET deleted_at = datetime('now'), updated_by = ? WHERE id = ?").bind(user.$id, found.child.id),
    eventStmt(c.env.DB, found.parent.id, user, {
      type: 'fact_removed', entityType: 'fact', entityId: found.child.id, field: found.child.label, oldValue: found.child.value, reason,
    }),
  ]);
  return c.json({ ok: true });
});

// ---- leads ------------------------------------------------------------------

const LEAD_FIELDS: Record<string, FieldSpec> = {
  sourceType: { col: 'source_type', parse: (v) => oneOf(v, SOURCE_TYPES) },
  providerName: { col: 'provider_name', parse: (v) => str(v, 200) },
  providerContact: { col: 'provider_contact', parse: (v) => str(v, 200), sensitive: true },
  providerEmail: { col: 'provider_email', parse: (v) => str(v, 200), sensitive: true },
  receivedAt: { col: 'received_at', parse: (v) => str(v, 40) || undefined },
  originalMessage: { col: 'original_message', parse: (v) => str(v, 20000) },
  translatedMessage: { col: 'translated_message', parse: (v) => str(v, 20000) },
  summary: { col: 'summary', parse: (v) => str(v, 5000) },
  status: { col: 'status', parse: (v) => oneOf(v, LEAD_STATUSES) },
  assignedTo: { col: 'assigned_to', parse: (v) => str(v, 100) },
  followUp: { col: 'follow_up', parse: (v) => str(v, 5000) },
  internalRemarks: { col: 'internal_remarks', parse: (v) => str(v, 10000) },
};

reunion.get('/cases/:id/leads', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const { results } = await c.env.DB
    .prepare(
      `SELECT l.*, u.name AS assigned_name FROM reunion_case_leads l LEFT JOIN users u ON u.id = l.assigned_to
       WHERE l.case_id = ? AND l.deleted_at IS NULL ORDER BY l.received_at DESC`
    )
    .bind(row.id)
    .all<Row>();
  return c.json({ documents: results.map(camel) });
});

// Inbox across every case this user can see: GET /reunion/leads?status=new
reunion.get('/leads', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const status = oneOf(c.req.query('status'), LEAD_STATUSES) || 'new';
  const v = visibleSql(user);
  const { results } = await c.env.DB
    .prepare(
      `SELECT l.id, l.case_id, rc.case_code, rc.title AS case_title, l.source_type, l.provider_name, l.received_at, l.summary, l.status
       FROM reunion_case_leads l JOIN reunion_cases rc ON rc.id = l.case_id
       WHERE l.status = ? AND l.deleted_at IS NULL AND rc.deleted_at IS NULL AND ${v.sql}
       ORDER BY l.received_at DESC LIMIT 200`
    )
    .bind(status, ...v.params)
    .all<Row>();
  return c.json({ documents: results.map(camel) });
});

reunion.post('/cases/:id/leads', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  const original = str(b?.originalMessage, 20000);
  const summary = str(b?.summary, 5000);
  if (!original && !summary) return c.json({ error: 'originalMessage or summary is required' }, 400);
  const assignedTo = str(b?.assignedTo, 100);
  if (assignedTo && !(await staffExists(c.env.DB, assignedTo))) return c.json({ error: 'assignedTo is not a known user' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO reunion_case_leads (id, case_id, source_type, provider_name, provider_contact, provider_email, received_at,
           original_message, translated_message, summary, status, assigned_to, follow_up, internal_remarks, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, row.id, oneOf(b?.sourceType, SOURCE_TYPES) || 'other', str(b?.providerName, 200) ?? null,
        str(b?.providerContact, 200) ?? null, str(b?.providerEmail, 200) ?? null, str(b?.receivedAt, 40) ?? null,
        original ?? null, str(b?.translatedMessage, 20000) ?? null, summary ?? null, oneOf(b?.status, LEAD_STATUSES) || 'new',
        assignedTo ?? null, str(b?.followUp, 5000) ?? null, str(b?.internalRemarks, 10000) ?? null, user.$id, user.$id),
    eventStmt(c.env.DB, row.id, user, { type: 'lead_added', entityType: 'lead', entityId: id, newValue: summary || original?.slice(0, 300) }),
    c.env.DB.prepare("UPDATE reunion_cases SET updated_at = datetime('now') WHERE id = ?").bind(row.id),
  ]);
  return c.json(camel(await c.env.DB.prepare('SELECT * FROM reunion_case_leads WHERE id = ?').bind(id).first<Row>()), 201);
});

reunion.patch('/leads/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadChild(c, user, 'reunion_case_leads', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  if (!b) return c.json({ error: 'Body required' }, 400);
  if (b.assignedTo && !(await staffExists(c.env.DB, String(b.assignedTo)))) return c.json({ error: 'assignedTo is not a known user' }, 400);
  const { stmts, changed } = diffUpdate(c.env.DB, 'reunion_case_leads', found.child, b, LEAD_FIELDS, user, found.parent.id, 'lead');
  if (stmts.length) {
    stmts.push(c.env.DB.prepare("UPDATE reunion_cases SET updated_at = datetime('now') WHERE id = ?").bind(found.parent.id));
    await c.env.DB.batch(stmts);
  }
  return c.json({ ok: true, changed });
});

// ---- contacts (sensitive: every listing is logged) ----------------------------

const CONTACT_FIELDS: Record<string, FieldSpec> = {
  name: { col: 'name', parse: (v) => str(v, 200) || undefined },
  role: { col: 'role', parse: (v) => oneOf(v, CONTACT_ROLES) },
  phone: { col: 'phone', parse: (v) => str(v, 100), sensitive: true },
  email: { col: 'email', parse: (v) => str(v, 200), sensitive: true },
  address: { col: 'address', parse: (v) => str(v, 1000), sensitive: true },
  notes: { col: 'notes', parse: (v) => str(v, 5000) },
};

reunion.get('/cases/:id/contacts', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const [list] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM reunion_case_contacts WHERE case_id = ? AND deleted_at IS NULL ORDER BY role, name').bind(row.id).all<Row>(),
    eventStmt(c.env.DB, row.id, user, { type: 'viewed_sensitive', entityType: 'contacts', entityId: row.id }).run(),
  ]);
  return c.json({ documents: list.results.map(camel) });
});

reunion.post('/cases/:id/contacts', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const row = await loadCase(c, user, c.req.param('id'));
  if (!row) return c.json({ error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  const name = str(b?.name, 200);
  if (!name) return c.json({ error: 'name is required' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `INSERT INTO reunion_case_contacts (id, case_id, name, role, phone, email, address, notes, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, row.id, name, oneOf(b?.role, CONTACT_ROLES) || 'other', str(b?.phone, 100) ?? null, str(b?.email, 200) ?? null,
        str(b?.address, 1000) ?? null, str(b?.notes, 5000) ?? null, user.$id, user.$id),
    eventStmt(c.env.DB, row.id, user, { type: 'contact_added', entityType: 'contact', entityId: id, newValue: name }),
  ]);
  return c.json(camel(await c.env.DB.prepare('SELECT * FROM reunion_case_contacts WHERE id = ?').bind(id).first<Row>()), 201);
});

reunion.patch('/contacts/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadChild(c, user, 'reunion_case_contacts', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  const b = (await c.req.json().catch(() => null)) as Row | null;
  if (!b) return c.json({ error: 'Body required' }, 400);
  const { stmts, changed } = diffUpdate(c.env.DB, 'reunion_case_contacts', found.child, b, CONTACT_FIELDS, user, found.parent.id, 'contact');
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true, changed });
});

reunion.delete('/contacts/:id', async (c) => {
  const user = await staffUser(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const found = await loadChild(c, user, 'reunion_case_contacts', c.req.param('id'));
  if (!found) return c.json({ error: 'Not found' }, 404);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE reunion_case_contacts SET deleted_at = datetime('now'), updated_by = ? WHERE id = ?").bind(user.$id, found.child.id),
    eventStmt(c.env.DB, found.parent.id, user, { type: 'contact_removed', entityType: 'contact', entityId: found.child.id, oldValue: found.child.name }),
  ]);
  return c.json({ ok: true });
});
