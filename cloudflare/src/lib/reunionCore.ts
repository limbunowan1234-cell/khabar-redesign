import type { Context } from 'hono';
import { verifyUser, isAdmin, isReunionStaff, type AppUser } from './auth';

// Shared by the Family Reunion routes (src/routes/reunion.ts and
// src/routes/reunionMedia.ts): access rules, history events and body parsing.
// The rules themselves are described at the top of src/routes/reunion.ts.

export type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string; IMAGES: R2Bucket; REUNION_PRIVATE: R2Bucket; AI: Ai; REUNION_AI_MOCK?: string; TURNSTILE_SECRET?: string };
export type Ctx = Context<{ Bindings: Bindings }>;
export type Row = Record<string, any>;

export const STATUSES = [
  'new_case', 'information_collection', 'investigation', 'lead_received', 'verification_pending',
  'public_appeal_ready', 'public_appeal_published', 'family_located', 'contact_established',
  'reunion_arranged', 'successfully_reunited', 'on_hold', 'closed', 'archived',
] as const;
// Statuses that claim an outcome or put a case in front of the public: admin only.
export const ADMIN_STATUSES = new Set([
  'public_appeal_published', 'family_located', 'contact_established', 'reunion_arranged',
  'successfully_reunited', 'closed', 'archived',
]);
export const ACTIVE_STATUSES = ['information_collection', 'investigation', 'lead_received'];
export const CATEGORIES = ['family_reconnection', 'lost_contact', 'origin_search', 'other'];
export const CONFIDENTIALITY = ['standard', 'restricted'];
export const FACT_SECTIONS = ['subject', 'family', 'background', 'clue', 'other'];
export const PROVENANCE = ['source_provided', 'verified', 'unverified', 'disputed'];
export const LEAD_STATUSES = ['new', 'under_review', 'verification_required', 'verified', 'unverified', 'incorrect', 'duplicate', 'closed'];
export const SOURCE_TYPES = ['public_form', 'phone', 'whatsapp', 'email', 'in_person', 'social_media', 'other'];
export const CONTACT_ROLES = ['subject', 'family', 'informant', 'official', 'other'];
export const CASE_CODE = /^KD-FR-\d{3,}$/;

// snake_case row -> camelCase API object, with $id like the rest of the API.
export function camel(row: Row | null): Row | null {
  if (!row) return null;
  const out: Row = { $id: row.id };
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id' || k === 'deleted_at') continue;
    out[k.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase())] = v;
  }
  return out;
}

export async function staffUser(c: Ctx): Promise<AppUser | null> {
  const user = await verifyUser(c.req.raw, c.env);
  return isReunionStaff(user) ? user : null;
}

export function canView(user: AppUser, row: Row): boolean {
  return isAdmin(user) || row.confidentiality !== 'restricted' || row.assigned_to === user.$id || row.created_by === user.$id;
}

// SQL fragment (alias "rc") limiting a query to cases this user may see.
export function visibleSql(user: AppUser): { sql: string; params: unknown[] } {
  if (isAdmin(user)) return { sql: '1 = 1', params: [] };
  return { sql: "(rc.confidentiality <> 'restricted' OR rc.assigned_to = ? OR rc.created_by = ?)", params: [user.$id, user.$id] };
}

// Accepts the internal id or the case code (KD-FR-001), any case.
export async function loadCase(c: Ctx, user: AppUser, idOrCode: string): Promise<Row | null> {
  const row = await c.env.DB
    .prepare('SELECT * FROM reunion_cases WHERE (id = ? OR case_code = ?) AND deleted_at IS NULL')
    .bind(idOrCode, idOrCode.toUpperCase())
    .first<Row>();
  return row && canView(user, row) ? row : null;
}

// Loads a child row (fact/lead/contact/media/consent) and checks its case is visible.
export async function loadChild(c: Ctx, user: AppUser, table: string, id: string): Promise<{ child: Row; parent: Row } | null> {
  const child = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`).bind(id).first<Row>();
  if (!child) return null;
  const parent = await loadCase(c, user, child.case_id);
  return parent ? { child, parent } : null;
}

export interface EventInput {
  type: string; entityType?: string; entityId?: string; field?: string;
  oldValue?: unknown; newValue?: unknown; reason?: string | null; note?: string | null;
}
export const asText = (v: unknown) => (v === null || v === undefined ? null : String(v).slice(0, 4000));
export function eventStmt(db: D1Database, caseId: string, user: AppUser | null, e: EventInput): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO reunion_case_events (id, case_id, event_type, entity_type, entity_id, field, old_value, new_value, reason, note, actor_id, actor_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), caseId, e.type, e.entityType || null, e.entityId || null, e.field || null,
      asText(e.oldValue), asText(e.newValue), e.reason || null, e.note || null, user?.$id || null, user?.name || null);
}

// ---- body parsing ----------------------------------------------------------
// undefined = field not sent (leave it alone); null = clear it.
export function str(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t || null;
}
export function oneOf(v: unknown, allowed: readonly string[]): string | undefined {
  return typeof v === 'string' && allowed.includes(v) ? v : undefined;
}
export const bool = (v: unknown) => (v === undefined ? undefined : v ? 1 : 0);

export interface FieldSpec { col: string; parse: (v: unknown) => unknown; sensitive?: boolean; adminOnly?: boolean }

// Builds an UPDATE plus one history event per changed field. Returns the
// statements to run (nothing if no field actually changed).
export function diffUpdate(
  db: D1Database, table: string, row: Row, body: Row, spec: Record<string, FieldSpec>,
  user: AppUser, caseId: string, entityType: string
): { stmts: D1PreparedStatement[]; changed: string[]; forbidden: string[] } {
  const sets: string[] = [];
  const params: unknown[] = [];
  const stmts: D1PreparedStatement[] = [];
  const changed: string[] = [];
  const forbidden: string[] = [];
  for (const [key, f] of Object.entries(spec)) {
    if (body[key] === undefined) continue;
    const value = f.parse(body[key]);
    if (value === undefined) continue;
    if (f.adminOnly && !isAdmin(user)) { forbidden.push(key); continue; }
    if (value === row[f.col]) continue;
    sets.push(`${f.col} = ?`);
    params.push(value);
    changed.push(key);
    stmts.push(eventStmt(db, caseId, user, {
      type: `${entityType}_changed`, entityType, entityId: row.id, field: key,
      oldValue: f.sensitive ? (row[f.col] ? '[changed]' : null) : row[f.col],
      newValue: f.sensitive ? (value ? '[changed]' : null) : value,
    }));
  }
  if (sets.length) {
    stmts.unshift(db.prepare(`UPDATE ${table} SET ${sets.join(', ')}, updated_by = ?, updated_at = datetime('now') WHERE id = ?`).bind(...params, user.$id, row.id));
  }
  return { stmts, changed, forbidden };
}

export async function staffExists(db: D1Database, id: string): Promise<boolean> {
  return !!(await db.prepare('SELECT 1 FROM users WHERE id = ?').bind(id).first());
}
