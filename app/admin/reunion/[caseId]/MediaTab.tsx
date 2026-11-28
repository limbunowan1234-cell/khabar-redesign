'use client';

import imageCompression from 'browser-image-compression';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Dialog from '../Dialog';
import type { ReunionViewer } from '../ReunionShell';
import {
  CONSENT_METHOD, CONSENT_SCOPE, RELATIONSHIP, fmtWhen, publicMediaUrl, reunionApi, reunionFile, reunionUpload,
} from '@/lib/reunion';
import s from '../Reunion.module.css';

// Private photo and document library for one case, plus its consent register.
// Files are fetched with the team member's token (never a public URL); only an
// admin can publish a photo, and only against an active photo consent.

interface Props { c: any; viewer: ReunionViewer; setDialog: (n: ReactNode) => void; close: () => void; done: () => Promise<void> }

// Photos are re-encoded to JPEG in the browser before upload. That also strips
// hidden metadata such as the GPS location a phone stores in the photo.
async function prepare(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const out = await imageCompression(file, { maxSizeMB: 8, maxWidthOrHeight: 3000, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.9 });
  return new File([out], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export default function MediaTab({ c, viewer, setDialog, close, done }: Props) {
  const [media, setMedia] = useState<any[] | null>(null);
  const [consents, setConsents] = useState<any[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [m, k] = await Promise.all([
        reunionApi<{ documents: any[] }>(`/cases/${c.$id}/media`),
        reunionApi<{ documents: any[] }>(`/cases/${c.$id}/consents`),
      ]);
      setMedia(m.documents); setConsents(k.documents); setError('');
    } catch (e: any) { setError(e.message); }
  }, [c.$id]);
  useEffect(() => { load(); }, [load]);
  const after = async () => { await done(); await load(); };
  const active = consents.filter((k) => !k.withdrawnAt);

  return (
    <>
      <Uploader caseId={c.$id} onUploaded={after} />
      {error && <p className={s.error}>{error}</p>}

      <section className={s.panel}>
        <h2 className={s.panelTitle}>Case files <span className={s.small}>{media ? `${media.length} file${media.length === 1 ? '' : 's'}` : ''}</span></h2>
        <p className={s.notice} style={{ marginBottom: 12 }}>Private. Files are stored outside the public website and open only for the case team. Each view is recorded in the history. A photo can appear publicly only after an admin publishes it with a recorded consent.</p>
        {media === null ? <p className={s.small}>Loading…</p> : media.length === 0 ? <p className={s.small}>No files yet.</p> : (
          <div className={s.mediaGrid}>
            {media.map((m) => (
              <MediaCard key={m.$id} m={m} isPhoto={c.publicPhotoMediaId === m.$id} viewer={viewer}
                onPublish={() => setDialog(<PublishDialog m={m} consents={active} onClose={close} onDone={after} />)}
                onRemove={() => setDialog(<RemoveDialog m={m} viewer={viewer} onClose={close} onDone={after} />)}
                onUnpublish={async () => { try { await reunionApi(`/media/${m.$id}/unpublish`, { method: 'POST', body: { reason: 'Unpublished from the media library' } }); await after(); } catch (e: any) { setError(e.message); } }}
              />
            ))}
          </div>
        )}
      </section>

      <section className={s.panel}>
        <h2 className={s.panelTitle}>Consent records
          <button type="button" className={s.btn} onClick={() => setDialog(<ConsentDialog caseId={c.$id} onClose={close} onDone={after} />)}>+ Record consent</button>
        </h2>
        <p className={s.small} style={{ marginTop: 0 }}>Who agreed to what, how and when. Withdrawing a consent removes any photo published under it at once and, if no story consent is left, switches the public page off. Withdrawn consents stay on record.</p>
        {consents.length === 0 ? <p className={s.small}>No consent recorded. Nothing about this case can be made public until there is one.</p> : consents.map((k) => (
          <div key={k.$id} className={s.fact}>
            <div className={s.factLabel}>{CONSENT_SCOPE[k.scope] || k.scope}</div>
            <div>
              <div className={s.factValue}>{k.givenBy} <span className={s.small}>({RELATIONSHIP[k.relationship] || k.relationship})</span></div>
              <div className={s.small}>{CONSENT_METHOD[k.method] || k.method} · given {k.givenAt}{k.recordedByName ? ` · recorded by ${k.recordedByName}` : ''}</div>
              {k.notes && <div className={s.small}>{k.notes}</div>}
            </div>
            <div className={s.factTags}>
              {k.withdrawnAt ? <span className={`${s.pill} ${s.t_off}`}>Withdrawn {fmtWhen(k.withdrawnAt, false)}</span> : <>
                <span className={`${s.pill} ${s.t_good}`}>Active</span>
                <button type="button" className={`${s.btn} ${s.btnGhost}`} style={{ padding: '4px 10px' }} onClick={() => setDialog(<WithdrawDialog k={k} onClose={close} onDone={after} />)}>Withdraw</button>
              </>}
            </div>
          </div>
        ))}
      </section>
    </>
  );
}

function Uploader({ caseId, onUploaded }: { caseId: string; onUploaded: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);

  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    for (const [i, raw] of [...files].entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      try {
        const file = await prepare(raw);
        const fd = new FormData();
        fd.append('file', file);
        if (caption.trim()) fd.append('caption', caption.trim());
        await reunionUpload(`/cases/${caseId}/media`, fd);
      } catch (e: any) { setError(`${raw.name}: ${e.message}`); }
    }
    setBusy(''); setCaption('');
    if (input.current) input.current.value = '';
    await onUploaded();
  };

  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>Add photos or documents</h2>
      <div className={`${s.drop} ${over ? s.dropOver : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Drop files here, or</p>
        <label className={`${s.btn} ${s.btnRed}`} style={{ marginTop: 8 }}>
          Choose files
          <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => send(e.target.files)} disabled={!!busy} />
        </label>
        <p className={s.small} style={{ margin: '8px 0 0' }}>Photos or PDF documents, up to 15 MB each. Photos are re-saved as JPEG, which removes hidden location data.</p>
      </div>
      <label className={s.field} style={{ marginTop: 12 }}><span>Caption for the next upload (optional)</span><input className={s.input} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Portrait supplied by the family, 2026" /></label>
      {busy && <p className={s.small}>{busy}</p>}
      {error && <p className={s.error}>{error}</p>}
    </section>
  );
}

function MediaCard({ m, isPhoto, viewer, onPublish, onUnpublish, onRemove }: { m: any; isPhoto: boolean; viewer: ReunionViewer; onPublish: () => void; onUnpublish: () => void; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (m.kind !== 'photo') return;
    let objectUrl: string | null = null;
    reunionFile(`/media/${m.$id}/file`).then((b) => { objectUrl = URL.createObjectURL(b); setUrl(objectUrl); }).catch(() => setFailed(true));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [m.$id, m.kind]);

  const open = async () => {
    const tab = window.open('', '_blank');
    try { const b = await reunionFile(`/media/${m.$id}/file`); if (tab) tab.location.href = URL.createObjectURL(b); } catch { tab?.close(); }
  };

  return (
    <article className={s.mediaCard}>
      <button type="button" className={s.mediaThumb} onClick={open} aria-label={`Open ${m.filename}`}>
        {m.kind === 'photo' ? (url ? <img src={url} alt={m.caption || m.filename} /> : <span>{failed ? 'Could not load' : 'Loading…'}</span>) : <span className={s.docIcon}>PDF</span>}
        {m.publicKey && <b className={s.publicBadge}>{isPhoto ? 'PUBLIC · CASE PHOTO' : 'PUBLIC'}</b>}
      </button>
      <div className={s.mediaBody}>
        <div className={s.mediaName} title={m.filename}>{m.caption || m.filename}</div>
        <div className={s.small}>{m.kind === 'photo' ? 'Photo' : 'Document'} · {Math.max(1, Math.round((m.sizeBytes || 0) / 1024))} KB · {fmtWhen(m.createdAt, false)}{m.uploadedByName ? ` · ${m.uploadedByName}` : ''}</div>
        <div className={s.mediaActions}>
          {viewer.isAdmin && m.kind === 'photo' && (m.publicKey
            ? <><button type="button" className={s.btn} onClick={onUnpublish}>Unpublish</button><a className={`${s.btn} ${s.btnGhost}`} href={publicMediaUrl(m.publicKey)} target="_blank" rel="noopener noreferrer">Public link</a></>
            : <button type="button" className={s.btn} onClick={onPublish}>Publish…</button>)}
          <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={onRemove}>Remove</button>
        </div>
      </div>
    </article>
  );
}

function PublishDialog({ m, consents, onClose, onDone }: { m: any; consents: any[]; onClose: () => void; onDone: () => Promise<void> }) {
  const usable = consents.filter((k) => ['public_photo', 'both'].includes(k.scope));
  const [consentId, setConsentId] = useState(usable[0]?.$id || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setError('');
    try { await reunionApi(`/media/${m.$id}/publish`, { method: 'POST', body: { consentId } }); await onDone(); } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Dialog title="Publish this photo" onClose={onClose} footer={<><button type="button" className={s.btn} onClick={onClose}>Cancel</button><button type="button" className={`${s.btn} ${s.btnRed}`} onClick={go} disabled={busy || !consentId}>Publish photo</button></>}>
      <p className={s.sub} style={{ marginTop: 0 }}>The photo is copied to the public website. Choose the consent that allows it. If that consent is withdrawn, the public copy is deleted automatically.</p>
      {usable.length === 0 ? <p className={s.error}>No active consent covers public photos. Record one first (scope: &ldquo;Public photo&rdquo; or &ldquo;Story and photo&rdquo;).</p> : (
        <label className={s.field}><span>Consent</span>
          <select className={s.select} value={consentId} onChange={(e) => setConsentId(e.target.value)}>
            {usable.map((k) => <option key={k.$id} value={k.$id}>{k.givenBy}: {CONSENT_SCOPE[k.scope]} ({CONSENT_METHOD[k.method]}, {k.givenAt})</option>)}
          </select>
        </label>
      )}
      {error && <p className={s.error}>{error}</p>}
    </Dialog>
  );
}

function RemoveDialog({ m, viewer, onClose, onDone }: { m: any; viewer: ReunionViewer; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [purge, setPurge] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setError('');
    try { await reunionApi(`/media/${m.$id}`, { method: 'DELETE', body: { reason, purge } }); await onDone(); } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Dialog title="Remove file" onClose={onClose} footer={<><button type="button" className={s.btn} onClick={onClose}>Cancel</button><button type="button" className={`${s.btn} ${s.btnRed}`} onClick={go} disabled={busy || reason.trim().length < 3}>{purge ? 'Delete permanently' : 'Remove'}</button></>}>
      <p className={s.sub} style={{ marginTop: 0 }}>&ldquo;{m.caption || m.filename}&rdquo; will be taken off the case{m.publicKey ? ' and off the public website' : ''}.</p>
      <label className={s.field}><span>Reason (recorded) *</span><input className={s.input} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
      {viewer.isAdmin && <label className={s.check}><input type="checkbox" checked={purge} onChange={(e) => setPurge(e.target.checked)} /> <span>Also delete the file from storage permanently (retention or a deletion request). This can&rsquo;t be undone.</span></label>}
      {error && <p className={s.error}>{error}</p>}
    </Dialog>
  );
}

function ConsentDialog({ caseId, onClose, onDone }: { caseId: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [f, setF] = useState({ givenBy: '', relationship: 'self', scope: 'both', method: 'written', givenAt: new Date().toISOString().slice(0, 10), notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const go = async () => {
    setBusy(true); setError('');
    try { await reunionApi(`/cases/${caseId}/consents`, { method: 'POST', body: f }); await onDone(); } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Dialog title="Record consent" onClose={onClose} footer={<><button type="button" className={s.btn} onClick={onClose}>Cancel</button><button type="button" className={`${s.btn} ${s.btnRed}`} onClick={go} disabled={busy || !f.givenBy.trim()}>Save consent</button></>}>
      <div className={s.formRow}>
        <label className={s.field}><span>Given by *</span><input className={s.input} value={f.givenBy} onChange={set('givenBy')} /></label>
        <label className={s.field}><span>Relationship</span><select className={s.select} value={f.relationship} onChange={set('relationship')}>{Object.entries(RELATIONSHIP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <div className={s.formRow}>
        <label className={s.field}><span>Agreed to</span><select className={s.select} value={f.scope} onChange={set('scope')}>{Object.entries(CONSENT_SCOPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className={s.field}><span>How</span><select className={s.select} value={f.method} onChange={set('method')}>{Object.entries(CONSENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <label className={s.field}><span>Date given</span><input className={s.input} type="date" value={f.givenAt} onChange={set('givenAt')} /></label>
      <label className={s.field}><span>Notes</span><textarea className={s.textarea} rows={2} value={f.notes} onChange={set('notes')} placeholder="e.g. Signed consent form saved under Case files; agreed to first name only" /></label>
      {error && <p className={s.error}>{error}</p>}
    </Dialog>
  );
}

function WithdrawDialog({ k, onClose, onDone }: { k: any; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setError('');
    try { await reunionApi(`/consents/${k.$id}/withdraw`, { method: 'POST', body: { reason } }); await onDone(); } catch (e: any) { setError(e.message); setBusy(false); }
  };
  return (
    <Dialog title="Withdraw consent" onClose={onClose} footer={<><button type="button" className={s.btn} onClick={onClose}>Cancel</button><button type="button" className={`${s.btn} ${s.btnRed}`} onClick={go} disabled={busy || reason.trim().length < 3}>Withdraw now</button></>}>
      <p className={s.sub} style={{ marginTop: 0 }}>{k.givenBy}&rsquo;s consent for &ldquo;{CONSENT_SCOPE[k.scope]}&rdquo; will be marked withdrawn. Photos published under it are removed from the website immediately.</p>
      <label className={s.field}><span>Reason (recorded) *</span><input className={s.input} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
      {error && <p className={s.error}>{error}</p>}
    </Dialog>
  );
}
