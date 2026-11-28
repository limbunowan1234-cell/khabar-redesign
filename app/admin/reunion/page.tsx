'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import ReunionShell, { type ReunionViewer } from './ReunionShell';
import StatusPill from './StatusPill';
import { CATEGORY, SOURCE_TYPE, STATUS, fmtWhen, reunionApi } from '@/lib/reunion';
import s from './Reunion.module.css';

interface Stats { total: number; active: number; awaitingVerification: number; awaitingAppeal: number; withNewLeads: number; reunited: number; archived: number }

// Each tile also acts as a filter for the list below it.
const TILES: { key: keyof Stats; label: string; filter: string }[] = [
  { key: 'total', label: 'Total cases', filter: '' },
  { key: 'active', label: 'Active investigations', filter: 'active' },
  { key: 'awaitingVerification', label: 'Awaiting verification', filter: 'verification_pending' },
  { key: 'awaitingAppeal', label: 'Awaiting public appeal', filter: 'public_appeal_ready' },
  { key: 'withNewLeads', label: 'Cases with new leads', filter: 'new_leads' },
  { key: 'reunited', label: 'Successful reunions', filter: 'successfully_reunited' },
  { key: 'archived', label: 'Archived', filter: 'archived' },
];
const ACTIVE = ['information_collection', 'investigation', 'lead_received'];

export default function ReunionDashboard() {
  return <ReunionShell>{(viewer) => <Dashboard viewer={viewer} />}</ReunionShell>;
}

function Dashboard({ viewer }: { viewer: ReunionViewer }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [inbox, setInbox] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter && filter !== 'active' && filter !== 'new_leads') params.set('status', filter);
      if (filter === 'archived') params.set('archived', '1');
      if (category) params.set('category', category);
      if (q.trim()) params.set('q', q.trim());
      const [st, list, leads] = await Promise.all([
        reunionApi<Stats>('/stats'),
        reunionApi<{ documents: any[] }>('/cases?' + params),
        reunionApi<{ documents: any[] }>('/leads?status=new'),
      ]);
      let docs = list.documents;
      if (filter === 'active') docs = docs.filter((d) => ACTIVE.includes(d.status));
      if (filter === 'new_leads') docs = docs.filter((d) => d.newLeads > 0);
      setStats(st); setCases(docs); setInbox(leads.documents); setError('');
    } catch (e: any) { setError(e.message); }
  }, [filter, category, q]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  return (
    <main className={s.wrap}>
      <div className={s.headRow}>
        <div>
          <h1 className={s.h1}>Family Reunion Cases</h1>
          <p className={s.sub}>Reconnecting families, one verified lead at a time. Signed in as {viewer.name}{viewer.isAdmin ? ' (admin)' : ''}.</p>
        </div>
        <button type="button" className={`${s.btn} ${s.btnRed}`} onClick={() => setCreating(true)}>+ New case</button>
      </div>

      {error && <p className={s.error}>{error}</p>}

      <section className={s.stats} aria-label="Case counts">
        {TILES.map((t) => (
          <button key={t.key} type="button" className={`${s.stat} ${filter === t.filter ? s.statOn : ''}`} onClick={() => setFilter(t.filter)} aria-pressed={filter === t.filter}>
            <b>{stats ? stats[t.key] : '–'}</b><span>{t.label}</span>
          </button>
        ))}
      </section>

      {inbox.length > 0 && (
        <section className={s.panel} style={{ marginBottom: 18 }} aria-label="New leads">
          <h2 className={s.panelTitle}>New leads to review <span className={s.leadDot}>{inbox.length}</span></h2>
          <div className={s.list}>
            {inbox.slice(0, 5).map((l) => (
              <Link key={l.$id} href={`/admin/reunion/${l.caseCode}?tab=leads`} className={s.row} style={{ gridTemplateColumns: '120px minmax(0,1fr) 160px' }}>
                <span className={s.code}>{l.caseCode}</span>
                <span><span className={s.rowTitle}>{l.summary || 'New information received'}</span><span className={s.rowMeta}>{SOURCE_TYPE[l.sourceType] || l.sourceType}{l.providerName ? ` · from ${l.providerName}` : ''}</span></span>
                <span className={s.small}>{fmtWhen(l.receivedAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className={s.tools}>
        <input className={`${s.input} ${s.search}`} type="search" placeholder="Search case ID, title or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cases" />
        <select className={s.select} value={STATUS[filter] ? filter : ''} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className={s.select} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {cases.length === 0 ? (
        <p className={s.empty}>{stats?.total === 0 && !filter && !q ? 'No cases yet. Create the first one with “New case”.' : 'No cases match these filters.'}</p>
      ) : (
        <div className={s.list}>
          {cases.map((c) => (
            <Link key={c.$id} href={`/admin/reunion/${c.caseCode}`} className={s.row}>
              <span className={s.code}>{c.caseCode}</span>
              <span>
                <span className={s.rowTitle}>{c.title}</span>
                <span className={s.rowMeta}>
                  {c.subjectName ? `${c.subjectName} · ` : ''}{CATEGORY[c.category] || c.category}
                  {c.confidentiality === 'restricted' && <> · <span className={s.private}>Restricted</span></>}
                </span>
              </span>
              <span className={s.small}>{c.assignedName ? `Assigned: ${c.assignedName}` : 'Unassigned'}<br />Updated {fmtWhen(c.updatedAt, false)}</span>
              <span>{c.newLeads > 0 && <span className={s.leadDot}>{c.newLeads} new lead{c.newLeads > 1 ? 's' : ''}</span>}</span>
              <span style={{ justifySelf: 'end' }}><StatusPill status={c.status} /></span>
            </Link>
          ))}
        </div>
      )}

      {creating && <NewCaseDialog onClose={() => setCreating(false)} />}
    </main>
  );
}

function NewCaseDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ title: '', subjectName: '', category: 'family_reconnection', originalLocation: '', currentLocation: '', description: '', confidentiality: 'standard', caseCode: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const body: Record<string, string> = { ...form };
      if (!body.caseCode.trim()) delete body.caseCode;
      const created = await reunionApi<{ caseCode: string }>('/cases', { method: 'POST', body });
      router.push('/admin/reunion/' + created.caseCode);
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="nc-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="nc-title" className={s.dialogTitle}>New family reunion case</h2>
        <p className={s.sub} style={{ marginBottom: 14 }}>Record only what the source told us. Names are saved exactly as typed. Add family details and clues on the case page, each marked with where it came from.</p>
        <div className={s.form}>
          <label className={s.field}><span>Case title *</span><input className={s.input} value={form.title} onChange={set('title')} maxLength={300} autoFocus /></label>
          <div className={s.formRow}>
            <label className={s.field}><span>Subject&rsquo;s name</span><input className={s.input} value={form.subjectName} onChange={set('subjectName')} maxLength={200} /></label>
            <label className={s.field}><span>Category</span>
              <select className={s.select} value={form.category} onChange={set('category')}>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
          </div>
          <div className={s.formRow}>
            <label className={s.field}><span>Original location</span><input className={s.input} value={form.originalLocation} onChange={set('originalLocation')} placeholder="As the source described it" /></label>
            <label className={s.field}><span>Current location</span><input className={s.input} value={form.currentLocation} onChange={set('currentLocation')} /></label>
          </div>
          <label className={s.field}><span>Internal description</span><textarea className={s.textarea} rows={4} value={form.description} onChange={set('description')} /><small>Never shown publicly.</small></label>
          <div className={s.formRow}>
            <label className={s.field}><span>Confidentiality</span>
              <select className={s.select} value={form.confidentiality} onChange={set('confidentiality')}>
                <option value="standard">Standard: whole case team</option>
                <option value="restricted">Restricted: admins and assigned journalist</option>
              </select>
            </label>
            <label className={s.field}><span>Case ID (optional)</span><input className={s.input} value={form.caseCode} onChange={set('caseCode')} placeholder="Auto, e.g. KD-FR-001" /></label>
          </div>
        </div>
        {error && <p className={s.error}>{error}</p>}
        <div className={s.dialogActions}>
          <button type="button" className={s.btn} onClick={onClose}>Cancel</button>
          <button type="button" className={`${s.btn} ${s.btnRed}`} onClick={save} disabled={saving || !form.title.trim()}>{saving ? 'Creating…' : 'Create case'}</button>
        </div>
      </div>
    </div>
  );
}
