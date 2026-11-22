// Shared by the public /road-status page and the /admin/roads editor.
// The status keys are also enforced by the Worker (cloudflare/src/routes/
// roads.ts STATUSES) -- change them in both places.

export const ROAD_STATUSES = [
  { key: 'closed', label: 'Closed', color: '#b91c1c', bg: '#fee2e2' },
  { key: 'restricted', label: 'Restricted', color: '#b45309', bg: '#fef3c7' },
  { key: 'open', label: 'Open', color: '#166534', bg: '#dcfce7' },
  { key: 'planned', label: 'Planned / in works', color: '#1d4ed8', bg: '#dbeafe' },
] as const;

export type RoadStatusKey = (typeof ROAD_STATUSES)[number]['key'];

export interface RoadEntry {
  $id: string;
  name: string;
  status: string;
  summary: string;
  details: string | null;
  diversion: string | null;
  nextDate: string | null;
  source: string | null;
  linkUrl: string | null;
  updatedAt: string;
  // Admin list only:
  active?: boolean;
  createdAt?: string;
}

export function statusMeta(key: string) {
  return ROAD_STATUSES.find((s) => s.key === key) || { key, label: key, color: '#374151', bg: '#f3f4f6' };
}

// D1's datetime('now') is UTC and looks like "2026-11-22 04:50:24" (no
// zone marker); the API may also hand back ISO strings. Treat both as UTC.
export function parseUtc(ts: string): Date {
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : ts.replace(' ', 'T') + 'Z';
  return new Date(iso);
}

// Shown in Indian time -- these readers are checking a road in the hills.
export function formatDay(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = parseUtc(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysSince(ts: string | null | undefined, now: number = Date.now()): number {
  if (!ts) return 0;
  const d = parseUtc(ts);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((now - d.getTime()) / 86_400_000));
}

// A closure or "open" note that hasn't been re-confirmed in this long may
// no longer be true. Planned/project rows are slow-moving by nature, so they
// don't trigger the warning.
export const STALE_AFTER_DAYS = 14;
export function isStale(entry: Pick<RoadEntry, 'status' | 'updatedAt'>, now: number = Date.now()): boolean {
  return entry.status !== 'planned' && daysSince(entry.updatedAt, now) >= STALE_AFTER_DAYS;
}
