import { getWorkerAuthToken } from '@/lib/appwrite';

// Client helpers for the Family Reunion case pages (app/admin/reunion).
// Everything private goes through the Worker's /reunion routes, which do the
// permission checks (cloudflare/src/routes/reunion.ts). NEXT_PUBLIC_WORKER_API
// only exists so the pages can be tested against a local Worker.

export const REUNION_API = process.env.NEXT_PUBLIC_WORKER_API || 'https://api.khabardarjeeling.in';
export const ADMIN_EMAIL = 'nowanad@gmail.com';

export async function reunionApi<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getWorkerAuthToken();
  const res = await fetch(REUNION_API + '/reunion' + path, {
    method: init.method || 'GET',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

// Private case file -> Blob (the file route needs the Bearer token, so it
// can't be used directly as an <img src>).
export async function reunionFile(path: string): Promise<Blob> {
  const token = await getWorkerAuthToken();
  const res = await fetch(REUNION_API + '/reunion' + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  if (!res.ok) throw new Error(`Could not open file (${res.status})`);
  return res.blob();
}

export async function reunionUpload<T = any>(path: string, form: FormData): Promise<T> {
  const token = await getWorkerAuthToken();
  const res = await fetch(REUNION_API + '/reunion' + path, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  return json as T;
}

export const publicMediaUrl = (key: string) => `${REUNION_API}/reunion/public-media/${key}`;

export const CONSENT_SCOPE: Record<string, string> = { public_story: 'Public story', public_photo: 'Public photo', both: 'Story and photo' };
export const CONSENT_METHOD: Record<string, string> = { written: 'Written / signed', verbal: 'Verbal', whatsapp: 'WhatsApp', email: 'Email', other: 'Other' };
export const RELATIONSHIP: Record<string, string> = { self: 'The subject', family: 'Family member', guardian: 'Guardian', other: 'Other' };

export const isReunionUser = (u: { email?: string; labels?: string[] } | null) =>
  !!u && (u.email?.toLowerCase() === ADMIN_EMAIL || (u.labels || []).includes('admin') || (u.labels || []).includes('reunion'));
export const isAdminUser = (u: { email?: string; labels?: string[] } | null) =>
  !!u && (u.email?.toLowerCase() === ADMIN_EMAIL || (u.labels || []).includes('admin'));

// Status labels as the newsroom reads them. Tone drives the colour.
export const STATUS: Record<string, { label: string; tone: 'new' | 'work' | 'lead' | 'wait' | 'public' | 'good' | 'done' | 'off' }> = {
  new_case: { label: 'New Case', tone: 'new' },
  information_collection: { label: 'Information Collection', tone: 'work' },
  investigation: { label: 'Investigation', tone: 'work' },
  lead_received: { label: 'Lead Received', tone: 'lead' },
  verification_pending: { label: 'Verification Pending', tone: 'wait' },
  public_appeal_ready: { label: 'Public Appeal Ready', tone: 'public' },
  public_appeal_published: { label: 'Public Appeal Published', tone: 'public' },
  family_located: { label: 'Family Located', tone: 'good' },
  contact_established: { label: 'Contact Established', tone: 'good' },
  reunion_arranged: { label: 'Reunion Arranged', tone: 'good' },
  successfully_reunited: { label: 'Successfully Reunited', tone: 'done' },
  on_hold: { label: 'On Hold', tone: 'off' },
  closed: { label: 'Closed', tone: 'off' },
  archived: { label: 'Archived', tone: 'off' },
};
export const statusLabel = (s: string) => STATUS[s]?.label || s;

export const PROVENANCE: Record<string, { label: string; hint: string }> = {
  source_provided: { label: 'Source-provided', hint: 'As told to us, not yet checked' },
  verified: { label: 'Independently verified', hint: 'Confirmed by an independent source' },
  unverified: { label: 'Unverified', hint: 'Checked, could not be confirmed' },
  disputed: { label: 'Disputed', hint: 'Sources disagree' },
};

export const LEAD_STATUS: Record<string, string> = {
  new: 'New', under_review: 'Under Review', verification_required: 'Verification Required', verified: 'Verified',
  unverified: 'Unverified', incorrect: 'Incorrect Information', duplicate: 'Duplicate', closed: 'Closed',
};
export const SOURCE_TYPE: Record<string, string> = {
  public_form: 'Public form', phone: 'Phone call', whatsapp: 'WhatsApp', email: 'Email', in_person: 'In person', social_media: 'Social media', other: 'Other',
};
export const CATEGORY: Record<string, string> = {
  family_reconnection: 'Family reconnection', lost_contact: 'Lost contact', origin_search: 'Origin search', other: 'Other',
};
export const FACT_SECTION: Record<string, string> = {
  subject: 'Subject', family: 'Family', background: 'Background', clue: 'Investigation clues', other: 'Other',
};
export const CONTACT_ROLE: Record<string, string> = {
  subject: 'Subject', family: 'Family', informant: 'Informant', official: 'Official', other: 'Other',
};

// "2026-11-28 06:15:02" (D1 UTC) or ISO -> local readable date/time.
export function fmtWhen(s: string | null | undefined, withTime = true): string {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('en-IN', withTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

// Plain-language line for one history event.
export function describeEvent(e: any): string {
  const f = e.field ? ` ${e.field}` : '';
  switch (e.eventType) {
    case 'case_created': return `Case ${e.newValue} created`;
    case 'case_changed': return `Changed${f}`;
    case 'status_changed': return `Status: ${statusLabel(e.oldValue)} → ${statusLabel(e.newValue)}`;
    case 'fact_added': return `Added fact "${e.field}"`;
    case 'fact_changed': return `Edited fact${f}`;
    case 'fact_removed': return `Removed fact "${e.field}"`;
    case 'lead_added': return 'New lead recorded';
    case 'lead_changed': return `Lead updated:${f}`;
    case 'contact_added': return `Contact added: ${e.newValue}`;
    case 'contact_changed': return `Contact updated:${f}`;
    case 'contact_removed': return `Contact removed: ${e.oldValue}`;
    case 'viewed_sensitive': return e.entityType === 'media' ? `Viewed file: ${e.newValue || ''}` : `Viewed ${e.entityType || 'sensitive records'}`;
    case 'update': return 'Investigation update';
    case 'case_deleted': return 'Case deleted';
    case 'media_added': return `File added: ${e.newValue}`;
    case 'media_changed': return 'File caption edited';
    case 'media_removed': return `File removed: ${e.oldValue}`;
    case 'media_purged': return `File permanently deleted: ${e.oldValue}`;
    case 'media_published': return `Photo published: ${e.newValue}`;
    case 'media_unpublished': return `Photo unpublished: ${e.oldValue}`;
    case 'consent_recorded': return 'Consent recorded';
    case 'consent_withdrawn': return 'Consent withdrawn';
    default: return e.eventType.replace(/_/g, ' ');
  }
}
