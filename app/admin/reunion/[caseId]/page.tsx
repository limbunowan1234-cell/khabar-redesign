'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import ReunionShell, { type ReunionViewer } from '../ReunionShell';
import StatusPill from '../StatusPill';
import Dialog from '../Dialog';
import MediaTab from './MediaTab';
import NewsTab from './NewsTab';
import PublicPanel from './PublicPanel';
import {
  CATEGORY, CONTACT_ROLE, FACT_SECTION, LEAD_STATUS, PROVENANCE, SOURCE_TYPE, STATUS,
  describeEvent, fmtWhen, reunionApi, statusLabel,
} from '@/lib/reunion';
import s from '../Reunion.module.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'personal', label: 'Personal Information' },
  { id: 'investigation', label: 'Investigation' },
  { id: 'leads', label: 'Leads' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'media', label: 'Media & Documents' },
  { id: 'articles', label: 'News Articles' },
  { id: 'history', label: 'Activity History' },
  { id: 'settings', label: 'Settings' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const ADMIN_STATUSES = new Set(['public_appeal_published', 'family_located', 'contact_established', 'reunion_arranged', 'successfully_reunited', 'closed', 'archived']);

export default function CasePage() {
  return (
    <ReunionShell>
      {(viewer) => (
        <Suspense fallback={<p className={s.gate}>Loading…</p>}>
          <Workspace viewer={viewer} />
        </Suspense>
      )}
    </ReunionShell>
  );
}

function Workspace({ viewer }: { viewer: ReunionViewer }) {
  const { caseId } = useParams<{ caseId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const tab = (TABS.some((t) => t.id === search.get('tab')) ? search.get('tab') : 'overview') as TabId;
  const [data, setData] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [team, setTeam] = useState<{ $id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [dialog, setDialog] = useState<ReactNode>(null);

  const reload = useCallback(async () => {
    try {
      const [c, ev] = await Promise.all([
        reunionApi(`/cases/${encodeURIComponent(caseId)}`),
        reunionApi<{ documents: any[] }>(`/cases/${encodeURIComponent(caseId)}/events`),
      ]);
      setData(c); setEvents(ev.documents); setError('');
    } catch (e: any) {
      if (/not found/i.test(e.message)) setMissing(true); else setError(e.message);
    }
  }, [caseId]);

  useEffect(() => { reload(); reunionApi<{ documents: any[] }>('/team').then((t) => setTeam(t.documents)).catch(() => {}); }, [reload]);

  const go = (id: TabId) => router.replace(`/admin/reunion/${caseId}${id === 'overview' ? '' : `?tab=${id}`}`, { scroll: false });
  const close = () => setDialog(null);
  const done = async () => { setDialog(null); await reload(); };

  if (missing) return <div className={s.gate}><h1 className={s.h1}>Case not found</h1><p className={s.sub}>It may not exist, may have been deleted, or may be restricted to other team members.</p><p><Link className={s.btn} href="/admin/reunion">Back to all cases</Link></p></div>;
  if (!data) return <main className={s.wrap}>{error ? <p className={s.error}>{error}</p> : <p className={s.sub}>Loading case…</p>}</main>;

  const c = data;
  const counts = c.counts || {};
  const tabCount: Partial<Record<TabId, number>> = { leads: counts.newLeads || undefined, history: events.length || undefined };

  return (
    <main className={s.wrap}>
      <p className={s.small} style={{ margin: '0 0 10px' }}><Link href="/admin/reunion">← All cases</Link></p>
      <section className={s.caseHead}>
        <div className={s.caseHeadTop}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span className={s.code}>{c.caseCode}</span>
              <StatusPill status={c.status} />
              {c.confidentiality === 'restricted' && <span className={`${s.pill} ${s.restricted}`}>Restricted</span>}
              {c.publicEnabled ? <span className={`${s.pill} ${s.t_public}`}>Public page on</span> : null}
            </div>
            <h1 className={s.h1}>{c.title}</h1>
          </div>
          <div className={s.caseActions}>
            <button type="button" className={`${s.btn} ${s.btnRed}`} onClick={() => setDialog(<UpdateDialog caseId={c.$id} onClose={close} onDone={done} />)}>+ Add Update</button>
            <Link className={s.btn} href={`/admin/reunion/${c.caseCode}/articles/new`}>✎ Create Article</Link>
          </div>
        </div>
        <div className={s.metaGrid}>
          <Meta label="Subject" value={c.subjectName} />
          <Meta label="Category" value={CATEGORY[c.category] || c.category} />
          <Meta label="Original location" value={c.originalLocation} />
          <Meta label="Current location" value={c.currentLocation} />
          <Meta label="Assigned journalist" value={c.assignedName || 'Unassigned'} />
          <Meta label="Opened" value={fmtWhen(c.createdAt, false)} />
          <Meta label="Last updated" value={fmtWhen(c.updatedAt)} />
        </div>
      </section>

      {error && <p className={s.error}>{error}</p>}

      <nav className={s.tabs} aria-label="Case sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`${s.tab} ${tab === t.id ? s.tabOn : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            {t.label}{tabCount[t.id] ? <small>{tabCount[t.id]}</small> : null}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview c={c} events={events} />}
      {tab === 'personal' && <Facts c={c} sections={['subject', 'family', 'background', 'other']} setDialog={setDialog} close={close} done={done} />}
      {tab === 'investigation' && (
        <>
          <Facts c={c} sections={['clue']} setDialog={setDialog} close={close} done={done} />
          <section className={s.panel}>
            <h2 className={s.panelTitle}>Investigation timeline
              <button type="button" className={s.btn} onClick={() => setDialog(<UpdateDialog caseId={c.$id} onClose={close} onDone={done} />)}>+ Add Update</button>
            </h2>
            <Timeline events={events.filter((e) => ['update', 'status_changed', 'lead_added', 'lead_changed', 'fact_added', 'case_created'].includes(e.eventType))} />
          </section>
        </>
      )}
      {tab === 'leads' && <Leads c={c} team={team} setDialog={setDialog} close={close} done={done} />}
      {tab === 'contacts' && <Contacts c={c} setDialog={setDialog} close={close} />}
      {tab === 'media' && <MediaTab c={c} viewer={viewer} setDialog={setDialog} close={close} done={done} />}
      {tab === 'articles' && <NewsTab c={c} />}
      {tab === 'history' && <section className={s.panel}><h2 className={s.panelTitle}>Activity history <span className={s.small}>Every change, kept permanently</span></h2><Timeline events={events} /></section>}
      {tab === 'settings' && <Settings c={c} viewer={viewer} team={team} onSaved={reload} />}

      {dialog}
    </main>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  return <div className={s.meta}><span>{label}</span><b>{value || '—'}</b></div>;
}

function ProvTag({ p }: { p: string }) {
  return <span className={`${s.prov} ${s['p_' + p]}`} title={PROVENANCE[p]?.hint}>{PROVENANCE[p]?.label || p}</span>;
}

// ---- Overview ------------------------------------------------------------------

function Overview({ c, events }: { c: any; events: any[] }) {
  const key = (c.facts || []).filter((f: any) => ['subject', 'family'].includes(f.section)).sort((a: any, b: any) => (a.section === b.section ? 0 : a.section === 'subject' ? -1 : 1));
  const counts = c.counts || {};
  return (
    <div className={s.cols}>
      <div>
        <section className={s.panel}>
          <h2 className={s.panelTitle}>Case description <span className={s.small}>Internal</span></h2>
          {c.description ? <p className={s.prose}>{c.description}</p> : <p className={s.small}>No description yet. Add one in Settings.</p>}
        </section>
        <section className={s.panel}>
          <h2 className={s.panelTitle}>Recent activity</h2>
          <Timeline events={events.filter((e) => e.eventType !== 'viewed_sensitive').slice(0, 6)} />
        </section>
      </div>
      <div>
        <section className={s.panel}>
          <h2 className={s.panelTitle}>Key details</h2>
          {key.length === 0 ? <p className={s.small}>No subject or family details recorded yet.</p> : key.map((f: any) => (
            <div key={f.$id} className={s.fact} style={{ gridTemplateColumns: '1fr' }}>
              <div className={s.factLabel}>{f.label}</div>
              <div className={s.factValue}>{f.value} <ProvTag p={f.provenance} /></div>
            </div>
          ))}
        </section>
        <section className={s.panel}>
          <h2 className={s.panelTitle}>At a glance</h2>
          <div className={s.metaGrid} style={{ marginTop: 0 }}>
            <Meta label="Leads" value={`${counts.leads || 0} (${counts.newLeads || 0} new)`} />
            <Meta label="Contacts" value={String(counts.contacts || 0)} />
            <Meta label="Media files" value={String(counts.media || 0)} />
            <Meta label="Articles" value={String(counts.articles || 0)} />
            <Meta label="Active consents" value={String(counts.activeConsents || 0)} />
          </div>
        </section>
      </div>
    </div>
  );
}

// ---- Timeline --------------------------------------------------------------------

function Timeline({ events }: { events: any[] }) {
  if (!events.length) return <p className={s.small}>Nothing recorded yet.</p>;
  return (
    <ol className={s.timeline}>
      {events.map((e) => {
        const cls = e.eventType === 'update' ? s.tUpdate : e.eventType === 'status_changed' ? s.tStatus : e.eventType.startsWith('lead') ? s.tLead : e.eventType === 'viewed_sensitive' ? s.tView : '';
        const showDiff = /_changed$/.test(e.eventType) && e.eventType !== 'status_changed' && (e.oldValue || e.newValue);
        return (
          <li key={e.$id} className={`${s.tItem} ${cls}`}>
            <div className={s.tWhat}>{describeEvent(e)}</div>
            <div className={s.tMeta}>{fmtWhen(e.createdAt)}{e.actorName ? ` · ${e.actorName}` : ''}</div>
            {e.reason && <div className={s.tDiff}>Reason: {e.reason}</div>}
            {showDiff && <div className={s.tDiff}>{e.oldValue ? <del>{e.oldValue}</del> : <em>empty</em>} → {e.newValue ? <ins>{e.newValue}</ins> : <em>cleared</em>}</div>}
            {e.eventType === 'fact_added' && e.newValue && <div className={s.tDiff}><ins>{String(e.newValue).replace(/ \((\w+)\)$/, (_: string, p: string) => ` (${PROVENANCE[p]?.label || p})`)}</ins></div>}
            {e.eventType === 'lead_added' && e.newValue && <div className={s.tDiff}>{e.newValue}</div>}
            {e.note && <div className={s.tNote}>{e.note}</div>}
          </li>
        );
      })}
    </ol>
  );
}

// ---- Facts -----------------------------------------------------------------------

interface DialogProps { setDialog: (n: ReactNode) => void; close: () => void; done: () => Promise<void> }

function Facts({ c, sections, setDialog, close, done }: { c: any; sections: string[] } & DialogProps) {
  const facts = (c.facts || []).filter((f: any) => sections.includes(f.section));
  const isClues = sections.length === 1 && sections[0] === 'clue';
  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>{isClues ? 'Investigation clues' : 'Personal and family information'}
        <button type="button" className={s.btn} onClick={() => setDialog(<FactDialog caseId={c.$id} defaultSection={sections[0]} onClose={close} onDone={done} />)}>+ Add {isClues ? 'clue' : 'detail'}</button>
      </h2>
      <p className={s.notice} style={{ marginBottom: 12 }}>Names are kept exactly as the source gave them. Never correct a spelling without verification. Mark each item as source-provided, independently verified, unverified or disputed. Nothing here is public unless it is marked public <em>and</em> an admin turns on the case&rsquo;s public page.</p>
      {facts.length === 0 ? <p className={s.small}>Nothing recorded yet.</p> : sections.map((sec) => {
        const group = facts.filter((f: any) => f.section === sec);
        if (!group.length) return null;
        return (
          <div key={sec} style={{ marginTop: 8 }}>
            {!isClues && <h3 className={s.small} style={{ margin: '10px 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>{FACT_SECTION[sec]}</h3>}
            {group.map((f: any) => (
              <div key={f.$id} className={s.fact}>
                <div className={s.factLabel}>{f.label}</div>
                <div>
                  <div className={s.factValue}>{f.value}</div>
                  {f.notes && <div className={s.small} style={{ marginTop: 3 }}>{f.notes}</div>}
                </div>
                <div className={s.factTags}>
                  <ProvTag p={f.provenance} />
                  {f.isPublic ? <span className={s.publicTag}>PUBLIC</span> : null}
                  <button type="button" className={`${s.btn} ${s.btnGhost}`} style={{ padding: '4px 10px' }} onClick={() => setDialog(<FactDialog caseId={c.$id} fact={f} onClose={close} onDone={done} />)}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function FactDialog({ caseId, fact, defaultSection, onClose, onDone }: { caseId: string; fact?: any; defaultSection?: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({
    section: fact?.section || defaultSection || 'clue', label: fact?.label || '', value: fact?.value || '',
    provenance: fact?.provenance || 'source_provided', isPublic: !!fact?.isPublic, notes: fact?.notes || '',
  });
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); await onDone(); } catch (e: any) { setError(e.message); setBusy(false); } };
  const save = () => run(() => fact ? reunionApi(`/facts/${fact.$id}`, { method: 'PATCH', body: f }) : reunionApi(`/cases/${caseId}/facts`, { method: 'POST', body: f }));
  const remove = () => run(() => reunionApi(`/facts/${fact.$id}`, { method: 'DELETE', body: { reason } }));

  return (
    <Dialog title={fact ? 'Edit detail' : 'Add detail'} onClose={onClose} footer={
      <>
        {fact && <button type="button" className={s.btn} style={{ marginRight: 'auto' }} onClick={remove} disabled={busy || reason.trim().length < 3} title="Type a reason to remove">Remove</button>}
        <button type="button" className={s.btn} onClick={onClose}>Cancel</button>
        <button type="button" className={`${s.btn} ${s.btnRed}`} onClick={save} disabled={busy || !f.label.trim() || !f.value.trim()}>Save</button>
      </>
    }>
      <div className={s.formRow}>
        <label className={s.field}><span>Section</span>
          <select className={s.select} value={f.section} onChange={(e) => setF({ ...f, section: e.target.value })}>{Object.entries(FACT_SECTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className={s.field}><span>Source / verification</span>
          <select className={s.select} value={f.provenance} onChange={(e) => setF({ ...f, provenance: e.target.value })}>{Object.entries(PROVENANCE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </label>
      </div>
      <label className={s.field}><span>Label</span><input className={s.input} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. Father's name" /></label>
      <label className={s.field}><span>Value (exactly as given)</span><input className={s.input} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} spellCheck={false} autoCorrect="off" autoCapitalize="off" /></label>
      <label className={s.field}><span>Notes</span><textarea className={s.textarea} rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Who said this, alternative spellings, how it was checked" /></label>
      <label className={s.check}><input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} /> <span>Approved for the public appeal page. Only tick this if sharing it can&rsquo;t put anyone at risk.</span></label>
      {fact && <label className={s.field}><span>Reason (needed only to remove)</span><input className={s.input} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
      {error && <p className={s.error}>{error}</p>}
    </Dialog>
  );
}

// ---- Add Update --------------------------------------------------------------------

function UpdateDialog({ caseId, onClose, onDone }: { caseId: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setError('');
    try { await reunionApi(`/cases/${caseId}/updates`, { method: 'POST', body: { note } }); await onDone(); } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Dialog title="Add investigation update" onClose={onClose} footer={
      <><button type="button" className={s.btn} onClick={onClose}>Cancel</button><button type="button" className={`${s.btn} ${s.btnRed}`} onClick={save} disabled={busy || !note.trim()}>Add to timeline</button></>
    }>
      <p className={s.sub} style={{ marginTop: 0 }}>What happened, who you spoke to, what was checked. Updates are permanent: correct mistakes with a new update.</p>
      <textarea className={s.textarea} rows={7} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      {error && <p className={s.error}>{error}</p>}
    </Dialog>
  );
}

// ---- Leads ----------------------------------------------------------------------------

function Leads({ c, team, setDialog, close, done }: { c: any; team: { $id: string; name: string }[] } & DialogProps) {
  const [leads, setLeads] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('');
  const load = useCallback(() => reunionApi<{ documents: any[] }>(`/cases/${c.$id}/leads`).then((r) => setLeads(r.documents)), [c.$id]);
  useEffect(() => { load(); }, [load]);
  const after = async () => { await done(); await load(); };
  const shown = (leads || []).filter((l) => !filter || l.status === filter);
  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>Leads and information received
        <span style={{ display: 'flex', gap: 8 }}>
          <select className={s.select} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter leads"><option value="">All</option>{Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button type="button" className={s.btn} onClick={() => setDialog(<LeadDialog caseId={c.$id} team={team} onClose={close} onDone={after} />)}>+ Record lead</button>
        </span>
      </h2>
      {leads === null ? <p className={s.small}>Loading…</p> : shown.length === 0 ? <p className={s.small}>No leads{filter ? ' with this status' : ' yet'}.</p> : shown.map((l) => (
        <article key={l.$id} className={s.lead}>
          <div className={s.leadTop}>
            <div>
              <b>{l.summary || 'Information received'}</b>
              <div className={s.small}>{SOURCE_TYPE[l.sourceType] || l.sourceType}{l.providerName ? ` · ${l.providerName}` : ''} · {fmtWhen(l.receivedAt)}{l.assignedName ? ` · Assigned: ${l.assignedName}` : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className={`${s.pill} ${l.status === 'new' ? s.t_lead : l.status === 'verified' ? s.t_good : ['incorrect', 'duplicate', 'closed'].includes(l.status) ? s.t_off : s.t_wait}`}>{LEAD_STATUS[l.status] || l.status}</span>
              <button type="button" className={s.btn} style={{ padding: '5px 10px' }} onClick={() => setDialog(<LeadDialog caseId={c.$id} lead={l} team={team} onClose={close} onDone={after} />)}>Review</button>
            </div>
          </div>
          {l.sourceType === 'public_form' && <p className={s.small} style={{ margin: '6px 0 0' }}><span className={`${s.pill} ${s.t_public}`}>Public submission</span>{l.consentGiven ? ' · Consent to be contacted given' : ''}</p>}
          {l.originalMessage && <p className={s.quote}>{l.originalMessage}</p>}
          {l.recognition && <p className={s.quote}><b>How they recognise the case:</b> {l.recognition}</p>}
          {l.attachments > 0 && <p className={s.small} style={{ marginBottom: 0 }}>📎 {l.attachments} attachment{l.attachments > 1 ? 's' : ''} (see Media &amp; Documents)</p>}
          {l.translatedMessage && <p className={s.quote}><b>Translation:</b> {l.translatedMessage}</p>}
          {(l.providerContact || l.providerEmail) && <p className={s.small} style={{ marginBottom: 0 }}><span className={s.private}>Private:</span> {[l.providerContact, l.providerEmail].filter(Boolean).join(' · ')}</p>}
          {l.followUp && <p className={s.small} style={{ marginBottom: 0 }}>Follow-up: {l.followUp}</p>}
          {l.internalRemarks && <p className={s.small} style={{ marginBottom: 0 }}>Internal: {l.internalRemarks}</p>}
        </article>
      ))}
    </section>
  );
}

function LeadDialog({ caseId, lead, team, onClose, onDone }: { caseId: string; lead?: any; team: { $id: string; name: string }[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({
    sourceType: lead?.sourceType || 'phone', providerName: lead?.providerName || '', providerContact: lead?.providerContact || '', providerEmail: lead?.providerEmail || '',
    originalMessage: lead?.originalMessage || '', translatedMessage: lead?.translatedMessage || '', summary: lead?.summary || '',
    status: lead?.status || 'new', assignedTo: lead?.assignedTo || '', followUp: lead?.followUp || '', internalRemarks: lead?.internalRemarks || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true); setError('');
    const body = { ...f, assignedTo: f.assignedTo || null };
    try {
      if (lead) await reunionApi(`/leads/${lead.$id}`, { method: 'PATCH', body }); else await reunionApi(`/cases/${caseId}/leads`, { method: 'POST', body });
      await onDone();
    } catch (e: any) { setError(e.message); setBusy(false); }
  };
  const fromPublic = lead?.sourceType === 'public_form';
  return (
    <Dialog title={lead ? 'Review lead' : 'Record a lead'} onClose={onClose} footer={
      <><button type="button" className={s.btn} onClick={onClose}>Cancel</button><button type="button" className={`${s.btn} ${s.btnRed}`} onClick={save} disabled={busy || (!f.originalMessage.trim() && !f.summary.trim())}>Save</button></>
    }>
      <div className={s.formRow}>
        <label className={s.field}><span>Source</span><select className={s.select} value={f.sourceType} onChange={set('sourceType')} disabled={fromPublic}>{Object.entries(SOURCE_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className={s.field}><span>Status</span><select className={s.select} value={f.status} onChange={set('status')}>{Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <div className={s.formRow}>
        <label className={s.field}><span>Person providing information</span><input className={s.input} value={f.providerName} onChange={set('providerName')} /></label>
        <label className={s.field}><span>Their phone <em className={s.private}>(private)</em></span><input className={s.input} value={f.providerContact} onChange={set('providerContact')} inputMode="tel" /></label>
      </div>
      <label className={s.field}><span>Original message (exactly as received)</span><textarea className={s.textarea} rows={4} value={f.originalMessage} onChange={set('originalMessage')} readOnly={fromPublic} /></label>
      <label className={s.field}><span>Translation</span><textarea className={s.textarea} rows={3} value={f.translatedMessage} onChange={set('translatedMessage')} /></label>
      <label className={s.field}><span>Summary</span><input className={s.input} value={f.summary} onChange={set('summary')} /></label>
      <div className={s.formRow}>
        <label className={s.field}><span>Assigned to</span><select className={s.select} value={f.assignedTo} onChange={set('assignedTo')}><option value="">Unassigned</option>{team.map((t) => <option key={t.$id} value={t.$id}>{t.name}</option>)}</select></label>
        <label className={s.field}><span>Follow-up needed</span><input className={s.input} value={f.followUp} onChange={set('followUp')} /></label>
      </div>
      <label className={s.field}><span>Internal remarks</span><textarea className={s.textarea} rows={2} value={f.internalRemarks} onChange={set('internalRemarks')} /></label>
      {error && <p className={s.error}>{error}</p>}
    </Dialog>
  );
}

// ---- Contacts --------------------------------------------------------------------------

function Contacts({ c, setDialog, close }: { c: any; setDialog: (n: ReactNode) => void; close: () => void }) {
  const [list, setList] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => reunionApi<{ documents: any[] }>(`/cases/${c.$id}/contacts`).then((r) => setList(r.documents)).catch((e) => setError(e.message)), [c.$id]);
  useEffect(() => { load(); }, [load]);
  const after = async () => { close(); await load(); };
  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>Contacts <button type="button" className={s.btn} onClick={() => setDialog(<ContactDialog caseId={c.$id} onClose={close} onDone={after} />)}>+ Add contact</button></h2>
      <p className={s.notice} style={{ marginBottom: 12 }}>Private. Phone numbers and addresses never appear on any public page. Opening this tab is recorded in the case history.</p>
      {error && <p className={s.error}>{error}</p>}
      {list === null ? <p className={s.small}>Loading…</p> : list.length === 0 ? <p className={s.small}>No contacts yet.</p> : list.map((p) => (
        <div key={p.$id} className={s.fact}>
          <div className={s.factLabel}>{CONTACT_ROLE[p.role] || p.role}</div>
          <div><div className={s.factValue}>{p.name}</div><div className={s.small}>{[p.phone, p.email, p.address].filter(Boolean).join(' · ') || 'No contact details'}</div>{p.notes && <div className={s.small}>{p.notes}</div>}</div>
          <div className={s.factTags}><button type="button" className={`${s.btn} ${s.btnGhost}`} style={{ padding: '4px 10px' }} onClick={() => setDialog(<ContactDialog caseId={c.$id} contact={p} onClose={close} onDone={after} />)}>Edit</button></div>
        </div>
      ))}
    </section>
  );
}

function ContactDialog({ caseId, contact, onClose, onDone }: { caseId: string; contact?: any; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ name: contact?.name || '', role: contact?.role || 'informant', phone: contact?.phone || '', email: contact?.email || '', address: contact?.address || '', notes: contact?.notes || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); await onDone(); } catch (e: any) { setError(e.message); setBusy(false); } };
  return (
    <Dialog title={contact ? 'Edit contact' : 'Add contact'} onClose={onClose} footer={
      <>
        {contact && <button type="button" className={s.btn} style={{ marginRight: 'auto' }} disabled={busy} onClick={() => run(() => reunionApi(`/contacts/${contact.$id}`, { method: 'DELETE' }))}>Remove</button>}
        <button type="button" className={s.btn} onClick={onClose}>Cancel</button>
        <button type="button" className={`${s.btn} ${s.btnRed}`} disabled={busy || !f.name.trim()} onClick={() => run(() => contact ? reunionApi(`/contacts/${contact.$id}`, { method: 'PATCH', body: f }) : reunionApi(`/cases/${caseId}/contacts`, { method: 'POST', body: f }))}>Save</button>
      </>
    }>
      <div className={s.formRow}>
        <label className={s.field}><span>Name</span><input className={s.input} value={f.name} onChange={set('name')} /></label>
        <label className={s.field}><span>Role</span><select className={s.select} value={f.role} onChange={set('role')}>{Object.entries(CONTACT_ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <div className={s.formRow}>
        <label className={s.field}><span>Phone</span><input className={s.input} value={f.phone} onChange={set('phone')} inputMode="tel" /></label>
        <label className={s.field}><span>Email</span><input className={s.input} value={f.email} onChange={set('email')} type="email" /></label>
      </div>
      <label className={s.field}><span>Address</span><input className={s.input} value={f.address} onChange={set('address')} /></label>
      <label className={s.field}><span>Notes</span><textarea className={s.textarea} rows={2} value={f.notes} onChange={set('notes')} /></label>
      {error && <p className={s.error}>{error}</p>}
    </Dialog>
  );
}

// ---- Settings --------------------------------------------------------------------------

function Settings({ c, viewer, team, onSaved }: { c: any; viewer: ReunionViewer; team: { $id: string; name: string }[]; onSaved: () => Promise<void> }) {
  const router = useRouter();
  const [status, setStatus] = useState(c.status);
  const [reason, setReason] = useState('');
  const [f, setF] = useState({ title: c.title || '', subjectName: c.subjectName || '', category: c.category, originalLocation: c.originalLocation || '', currentLocation: c.currentLocation || '', description: c.description || '', assignedTo: c.assignedTo || '', confidentiality: c.confidentiality });
  const [delReason, setDelReason] = useState('');
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const act = async (fn: () => Promise<unknown>, ok: string) => { setMsg({}); try { await fn(); await onSaved(); setMsg({ ok }); } catch (e: any) { setMsg({ err: e.message }); } };

  const saveDetails = () => {
    const body: Record<string, unknown> = { ...f, assignedTo: f.assignedTo || null };
    if (!viewer.isAdmin) delete body.confidentiality;
    return act(() => reunionApi(`/cases/${c.$id}`, { method: 'PATCH', body }), 'Details saved.');
  };

  return (
    <>
      {(msg.ok || msg.err) && <p className={msg.err ? s.error : s.notice} style={{ marginTop: 0, marginBottom: 14 }}>{msg.err || msg.ok}</p>}
      <section className={s.panel}>
        <h2 className={s.panelTitle}>Case status</h2>
        <div className={s.form}>
          <div className={s.formRow}>
            <label className={s.field}><span>New status</span>
              <select className={s.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k} disabled={!viewer.isAdmin && ADMIN_STATUSES.has(k)}>{v.label}{!viewer.isAdmin && ADMIN_STATUSES.has(k) ? ' (admin)' : ''}</option>)}
              </select>
            </label>
            <label className={s.field}><span>Reason (recorded) *</span><input className={s.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the status is changing" /></label>
          </div>
          <p className={s.small} style={{ margin: 0 }}>Never mark a family as located or reunited without reliable evidence. Outcome statuses need an admin.</p>
          <div><button type="button" className={`${s.btn} ${s.btnRed}`} disabled={status === c.status || reason.trim().length < 3}
            onClick={() => act(async () => { await reunionApi(`/cases/${c.$id}/status`, { method: 'POST', body: { status, reason } }); setReason(''); }, `Status changed to ${statusLabel(status)}.`)}>Change status</button></div>
        </div>
      </section>

      <section className={s.panel}>
        <h2 className={s.panelTitle}>Case details</h2>
        <div className={s.form}>
          <label className={s.field}><span>Title</span><input className={s.input} value={f.title} onChange={set('title')} /></label>
          <div className={s.formRow}>
            <label className={s.field}><span>Subject&rsquo;s name</span><input className={s.input} value={f.subjectName} onChange={set('subjectName')} spellCheck={false} /></label>
            <label className={s.field}><span>Category</span><select className={s.select} value={f.category} onChange={set('category')}>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className={s.formRow}>
            <label className={s.field}><span>Original location</span><input className={s.input} value={f.originalLocation} onChange={set('originalLocation')} /></label>
            <label className={s.field}><span>Current location</span><input className={s.input} value={f.currentLocation} onChange={set('currentLocation')} /></label>
          </div>
          <div className={s.formRow}>
            <label className={s.field}><span>Assigned journalist</span><select className={s.select} value={f.assignedTo} onChange={set('assignedTo')}><option value="">Unassigned</option>{team.map((t) => <option key={t.$id} value={t.$id}>{t.name}</option>)}</select></label>
            <label className={s.field}><span>Confidentiality {viewer.isAdmin ? '' : '(admin)'}</span>
              <select className={s.select} value={f.confidentiality} onChange={set('confidentiality')} disabled={!viewer.isAdmin}>
                <option value="standard">Standard: whole case team</option><option value="restricted">Restricted: admins and assigned journalist</option>
              </select>
            </label>
          </div>
          <label className={s.field}><span>Internal description</span><textarea className={s.textarea} rows={5} value={f.description} onChange={set('description')} /></label>
          <div><button type="button" className={`${s.btn} ${s.btnRed}`} onClick={saveDetails}>Save details</button></div>
        </div>
      </section>

      <PublicPanel c={c} viewer={viewer} onSaved={onSaved} />

      {viewer.isAdmin && (
        <section className={s.panel}>
          <h2 className={s.panelTitle}>Delete case</h2>
          <p className={s.small} style={{ marginTop: 0 }}>Hides the case from everyone. Its records and history stay in the database.</p>
          <div className={s.formRow}>
            <input className={s.input} value={delReason} onChange={(e) => setDelReason(e.target.value)} placeholder="Reason (recorded)" aria-label="Reason for deleting" />
            <button type="button" className={s.btn} disabled={delReason.trim().length < 3}
              onClick={() => act(async () => { await reunionApi(`/cases/${c.$id}`, { method: 'DELETE', body: { reason: delReason } }); router.push('/admin/reunion'); }, 'Case deleted.')}>Delete case</button>
          </div>
        </section>
      )}
    </>
  );
}
