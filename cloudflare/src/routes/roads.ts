import { Hono } from 'hono';
import { verifyUser, isAdmin } from '../lib/auth';

type Bindings = { DB: D1Database; AUTH_JWT_SECRET: string };

export const roads = new Hono<{ Bindings: Bindings }>();

// The /road-status page's backend: closures, restrictions, diversions and
// road/bridge projects. Public read; admin-only write.

const STATUSES = ['closed', 'restricted', 'open', 'planned'];

function toJson(row: any, admin: boolean) {
  const base = {
    $id: row.id,
    name: row.name,
    status: row.status,
    summary: row.summary,
    details: row.details,
    diversion: row.diversion,
    nextDate: row.next_date,
    source: row.source,
    linkUrl: row.link_url,
    updatedAt: row.updated_at,
  };
  return admin ? { ...base, active: !!row.active, createdAt: row.created_at } : base;
}

// GET /roads            -> active entries, most serious first (public)
// GET /roads?all=1      -> including hidden ones (admin JWT; anyone else
//                          silently gets the public list)
roads.get('/', async (c) => {
  let admin = false;
  if (c.req.query('all') === '1') admin = isAdmin(await verifyUser(c.req.raw, c.env));

  const sql = `SELECT * FROM road_status ${admin ? '' : 'WHERE active = 1'}
    ORDER BY CASE status WHEN 'closed' THEN 0 WHEN 'restricted' THEN 1 WHEN 'open' THEN 2 ELSE 3 END, updated_at DESC
    LIMIT 200`;
  const { results } = await c.env.DB.prepare(sql).all();
  const docs = (results || []).map((r: any) => toJson(r, admin));
  // The page's "last updated" -- the newest change among what's shown.
  const updatedAt = docs.reduce((latest: string | null, d: any) => (!latest || d.updatedAt > latest ? d.updatedAt : latest), null);
  return c.json({ documents: docs, total: docs.length, updatedAt });
});

type Parsed = { values: Record<string, unknown>; error?: string };

// Validates whichever whitelisted fields are present in `body`. Absent
// fields are left alone; null (or empty) clears the optional ones.
function parseFields(body: any): Parsed {
  const v: Record<string, unknown> = {};
  const str = (x: unknown, max: number) => (typeof x === 'string' ? x.trim().slice(0, max) : undefined);

  for (const [field, max] of [['name', 200], ['summary', 500]] as const) {
    if (field in body) {
      const s = str(body[field], max);
      if (!s) return { values: v, error: field + ' is required' };
      v[field] = s;
    }
  }
  if ('status' in body) {
    if (!STATUSES.includes(body.status)) return { values: v, error: 'status must be one of: ' + STATUSES.join(', ') };
    v.status = body.status;
  }
  for (const [field, max] of [['details', 4000], ['diversion', 2000], ['nextDate', 200], ['source', 500]] as const) {
    if (field in body) v[field] = body[field] === null ? null : (str(body[field], max) || null);
  }
  if ('linkUrl' in body) {
    const u = body.linkUrl === null ? '' : str(body.linkUrl, 500) || '';
    if (!u) v.linkUrl = null;
    // Our own page ("/article/...") or a full web link -- nothing else
    // (no javascript: URLs, no protocol-relative "//host" tricks).
    else if ((u.startsWith('/') && !u.startsWith('//')) || /^https?:\/\//i.test(u)) v.linkUrl = u;
    else return { values: v, error: 'linkUrl must start with / (a page on this site) or https://' };
  }
  if ('active' in body) v.active = body.active ? 1 : 0;
  return { values: v };
}

const COLUMN: Record<string, string> = {
  name: 'name', status: 'status', summary: 'summary', details: 'details', diversion: 'diversion',
  nextDate: 'next_date', source: 'source', linkUrl: 'link_url', active: 'active',
};

// POST /roads -- admin only. name, status and summary are required.
roads.post('/', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);

  const { values, error } = parseFields(body);
  if (error) return c.json({ error }, 400);
  if (!values.name || !values.status || !values.summary) return c.json({ error: 'name, status and summary are required' }, 400);

  const id = crypto.randomUUID();
  const cols = ['id', ...Object.keys(values).map((k) => COLUMN[k])];
  await c.env.DB
    .prepare(`INSERT INTO road_status (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .bind(id, ...Object.values(values))
    .run();
  return c.json({ ok: true, id });
});

// PATCH /roads/:id -- admin only, partial. Bumps updated_at, which is what
// the public page shows as when this entry was last confirmed.
roads.patch('/:id', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM road_status WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid JSON' }, 400);
  const { values, error } = parseFields(body);
  if (error) return c.json({ error }, 400);

  const keys = Object.keys(values);
  if (keys.length === 0) return c.json({ error: 'Nothing to update' }, 400);
  const sets = keys.map((k) => `${COLUMN[k]} = ?`).concat("updated_at = datetime('now')");
  await c.env.DB.prepare(`UPDATE road_status SET ${sets.join(', ')} WHERE id = ?`).bind(...Object.values(values), id).run();
  return c.json({ ok: true });
});

// DELETE /roads/:id -- admin only, idempotent.
roads.delete('/:id', async (c) => {
  if (!isAdmin(await verifyUser(c.req.raw, c.env))) return c.json({ error: 'Unauthorized' }, 401);
  await c.env.DB.prepare('DELETE FROM road_status WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
