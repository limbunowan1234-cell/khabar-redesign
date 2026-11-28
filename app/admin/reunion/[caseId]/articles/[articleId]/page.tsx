'use client';

import imageCompression from 'browser-image-compression';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import ReunionShell, { type ReunionViewer } from '../../../ReunionShell';
import Dialog from '../../../Dialog';
import {
  AI_FORMATS, ARTICLE_STATUS, DISTRICTS, GENRES, articleImageUpload, articleImageUrl, reunionApi,
} from '@/lib/reunion';
import s from '../../../Reunion.module.css';

// Article editor for one case article ("new" creates one). Saving never
// publishes: articles move through Draft -> Editorial Review -> Approved ->
// Published with the buttons in the workflow panel, and the Worker enforces
// who may make each move and that a story consent exists before publishing.

interface Form {
  title: string; sideHeader: string; content: string; genre: string; locationDistrict: string; locationArea: string;
  imageFileId: string; imageCaption: string; authorName: string; seoTitle: string; metaDescription: string; keywords: string; socialDescription: string;
  supportingImages: { fileId: string; caption: string }[];
}
const EMPTY: Form = {
  title: '', sideHeader: '', content: '', genre: 'Voice of People', locationDistrict: 'Darjeeling', locationArea: '', imageFileId: '', imageCaption: '',
  authorName: '', seoTitle: '', metaDescription: '', keywords: '', socialDescription: '', supportingImages: [],
};

export default function ArticleEditorPage() {
  return <ReunionShell>{(viewer) => <Editor viewer={viewer} />}</ReunionShell>;
}

function Editor({ viewer }: { viewer: ReunionViewer }) {
  const { caseId, articleId } = useParams<{ caseId: string; articleId: string }>();
  const router = useRouter();
  const isNew = articleId === 'new';
  const [caseRow, setCaseRow] = useState<any>(null);
  const [article, setArticle] = useState<any>(null);
  const [form, setForm] = useState<Form>({ ...EMPTY, authorName: viewer.name });
  const [photos, setPhotos] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<ReactNode>(null);

  const load = useCallback(async () => {
    try {
      const c = await reunionApi(`/cases/${encodeURIComponent(caseId)}`);
      setCaseRow(c);
      const media = await reunionApi<{ documents: any[] }>(`/cases/${c.$id}/media`);
      setPhotos(media.documents.filter((m) => m.publicKey));
      if (!isNew) {
        const a = await reunionApi(`/case-articles/${articleId}`);
        setArticle(a);
        setForm({
          title: a.title || '', sideHeader: a.sideHeader || '', content: a.content || '', genre: a.genre || 'Voice of People',
          locationDistrict: a.locationDistrict || 'Darjeeling', locationArea: a.locationArea || '', imageFileId: a.imageFileId || '',
          imageCaption: a.imageCaption || '', authorName: a.authorName || '', seoTitle: a.seoTitle || '', metaDescription: a.metaDescription || '',
          keywords: a.keywords || '', socialDescription: a.socialDescription || '', supportingImages: a.supportingImages || [],
        });
        setDirty(false);
      }
    } catch (e: any) { setMsg({ err: e.message }); }
  }, [caseId, articleId, isNew]);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof Form) => (e: { target: { value: string } }) => { setForm((f) => ({ ...f, [k]: e.target.value })); setDirty(true); };
  const status = article?.status || 'draft';
  const locked = ['approved', 'published'].includes(status) && !viewer.isAdmin;

  const save = async (): Promise<string | null> => {
    setBusy(true); setMsg({});
    try {
      const body = { ...form, imageFileId: form.imageFileId || null };
      if (isNew) {
        const a = await reunionApi(`/cases/${caseRow.$id}/articles`, { method: 'POST', body });
        router.replace(`/admin/reunion/${caseRow.caseCode}/articles/${a.$id}`);
        return a.$id;
      }
      await reunionApi(`/case-articles/${article.$id}`, { method: 'PATCH', body });
      setMsg({ ok: 'Saved.' }); setDirty(false);
      await load();
      return article.$id;
    } catch (e: any) { setMsg({ err: e.message }); return null; } finally { setBusy(false); }
  };

  const move = async (to: string, note?: string) => {
    setBusy(true); setMsg({});
    try {
      if (dirty && !locked) await reunionApi(`/case-articles/${article.$id}`, { method: 'PATCH', body: { ...form, imageFileId: form.imageFileId || null } });
      await reunionApi(`/case-articles/${article.$id}/status`, { method: 'POST', body: { status: to, note } });
      await load();
      setMsg({ ok: `Moved to ${ARTICLE_STATUS[to].label}.` });
    } catch (e: any) { setMsg({ err: e.message }); } finally { setBusy(false); }
  };

  if (!caseRow) return <main className={s.wrap}>{msg.err ? <p className={s.error}>{msg.err}</p> : <p className={s.sub}>Loading…</p>}</main>;
  const st = ARTICLE_STATUS[status];

  return (
    <main className={s.wrap}>
      <p className={s.small} style={{ margin: '0 0 10px' }}><Link href={`/admin/reunion/${caseRow.caseCode}?tab=articles`}>← {caseRow.caseCode} newsroom</Link></p>
      <div className={s.headRow} style={{ marginBottom: 14 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span className={s.code}>{caseRow.caseCode}</span>
            <span className={`${s.pill} ${s['t_' + st.tone]}`}>{st.label}</span>
          </div>
          <h1 className={s.h1}>{isNew ? 'New case article' : form.title || 'Untitled article'}</h1>
          <p className={s.sub}>Linked to case: {caseRow.title}</p>
        </div>
        <div className={s.caseActions}>
          <button type="button" className={`${s.btn} ${s.btnRed}`} onClick={save} disabled={busy || locked || !form.title.trim()}>{isNew ? 'Create draft' : 'Save'}</button>
        </div>
      </div>
      {(msg.ok || msg.err) && <p className={msg.err ? s.error : s.notice} style={{ marginTop: 0, marginBottom: 14 }}>{msg.err || msg.ok}</p>}
      {locked && <p className={s.notice} style={{ marginBottom: 14 }}>This article is {st.label.toLowerCase()}. Only an admin can change the text now.</p>}

      <div className={s.cols}>
        <div>
          <section className={s.panel}>
            <h2 className={s.panelTitle}>Article</h2>
            <fieldset disabled={locked} className={s.form} style={{ border: 0, padding: 0, margin: 0 }}>
              <label className={s.field}><span>Headline *</span><input className={s.input} value={form.title} onChange={set('title')} maxLength={300} /></label>
              <label className={s.field}><span>Subheadline</span><input className={s.input} value={form.sideHeader} onChange={set('sideHeader')} maxLength={500} /></label>
              <div className={s.field}>
                <label className={s.field}><span>Article body</span>
                  <textarea className={s.textarea} rows={16} value={form.content} onChange={set('content')} spellCheck={false} aria-describedby="body-hint" />
                </label>
                <small id="body-hint">Formatting: <code>## </code> subheading, <code>**bold**</code>, <code>&gt; </code> pull-quote, <code>[[image:2]]</code> places additional photo 2. Write only what the case record supports; attribute unverified details (&ldquo;she recalls&rdquo;, &ldquo;reportedly&rdquo;).</small>
              </div>
              <div className={s.formRow}>
                <label className={s.field}><span>Category</span><select className={s.select} value={form.genre} onChange={set('genre')}>{GENRES.map((g) => <option key={g}>{g}</option>)}</select></label>
                <label className={s.field}><span>Author</span><input className={s.input} value={form.authorName} onChange={set('authorName')} /></label>
              </div>
              <div className={s.formRow}>
                <label className={s.field}><span>District</span><select className={s.select} value={form.locationDistrict} onChange={set('locationDistrict')}>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
                <label className={s.field}><span>Area / locality</span><input className={s.input} value={form.locationArea} onChange={set('locationArea')} placeholder="e.g. near Darjeeling Railway Station" /></label>
              </div>
            </fieldset>
          </section>

          <Images form={form} setForm={(f) => { setForm(f); setDirty(true); }} photos={photos} locked={locked} />

          <section className={s.panel}>
            <h2 className={s.panelTitle}>Search and social</h2>
            <fieldset disabled={locked} className={s.form} style={{ border: 0, padding: 0, margin: 0 }}>
              <label className={s.field}><span>SEO title <em className={s.small}>{form.seoTitle.length}/60</em></span><input className={s.input} value={form.seoTitle} onChange={set('seoTitle')} maxLength={120} /></label>
              <label className={s.field}><span>Meta description <em className={s.small}>{form.metaDescription.length}/155</em></span><textarea className={s.textarea} rows={2} value={form.metaDescription} onChange={set('metaDescription')} maxLength={320} /></label>
              <label className={s.field}><span>Keywords</span><input className={s.input} value={form.keywords} onChange={set('keywords')} placeholder="Comma separated" /></label>
              <label className={s.field}><span>Social media description</span><textarea className={s.textarea} rows={2} value={form.socialDescription} onChange={set('socialDescription')} maxLength={500} /></label>
            </fieldset>
          </section>
        </div>

        <div>
          {!isNew && <Workflow status={status} viewer={viewer} busy={busy} slug={article?.slug} onMove={move} setDialog={setDialog} />}
          {isNew && <section className={s.panel}><h2 className={s.panelTitle}>Workflow</h2><p className={s.small} style={{ margin: 0 }}>Create the draft first. It can then be sent for editorial review.</p></section>}
          <AiPanel caseId={caseRow.$id} locked={locked} onUse={(patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); setMsg({ ok: 'AI draft placed in the editor. Check every line against the case record, then save.' }); }} />
        </div>
      </div>
      {dialog}
    </main>
  );
}

// ---- workflow -------------------------------------------------------------------

function Workflow({ status, viewer, busy, slug, onMove, setDialog }: { status: string; viewer: ReunionViewer; busy: boolean; slug?: string; onMove: (to: string, note?: string) => Promise<void>; setDialog: (n: ReactNode) => void }) {
  const steps = ['draft', 'pending_review', 'approved', 'published'];
  const at = steps.indexOf(status);
  const sendBack = () => setDialog(<NoteDialog title="Send back to Draft" label="What needs changing? *" required onClose={() => setDialog(null)} onOk={async (note) => { setDialog(null); await onMove('draft', note); }} />);
  const approve = () => setDialog(<NoteDialog title="Approve article" label="Review note (optional)" onClose={() => setDialog(null)} onOk={async (note) => { setDialog(null); await onMove('approved', note); }} />);
  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>Workflow</h2>
      <ol className={s.steps}>
        {steps.map((k, i) => <li key={k} className={i < at ? s.stepDone : i === at ? s.stepOn : ''}>{ARTICLE_STATUS[k].label}</li>)}
      </ol>
      <div className={s.form} style={{ marginTop: 12 }}>
        {status === 'draft' && <button type="button" className={`${s.btn} ${s.btnRed}`} disabled={busy} onClick={() => onMove('pending_review')}>Submit for editorial review</button>}
        {status === 'pending_review' && <>
          {viewer.isAdmin && <button type="button" className={`${s.btn} ${s.btnRed}`} disabled={busy} onClick={approve}>Approve</button>}
          <button type="button" className={s.btn} disabled={busy} onClick={sendBack}>Send back to draft</button>
          {!viewer.isAdmin && <p className={s.small} style={{ margin: 0 }}>Waiting for an admin to approve.</p>}
        </>}
        {status === 'approved' && (viewer.isAdmin ? <>
          <button type="button" className={`${s.btn} ${s.btnRed}`} disabled={busy} onClick={() => onMove('published')}>Publish</button>
          <button type="button" className={s.btn} disabled={busy} onClick={() => onMove('pending_review')}>Return to review</button>
          <p className={s.small} style={{ margin: 0 }}>Publishing needs an active story consent on the case.</p>
        </> : <p className={s.small} style={{ margin: 0 }}>Approved. An admin will publish it.</p>)}
        {status === 'published' && <>
          {slug && <a className={s.btn} href={`/article/${slug}`} target="_blank" rel="noopener noreferrer">View live article ↗</a>}
          {viewer.isAdmin && <button type="button" className={s.btn} disabled={busy} onClick={() => onMove('approved')}>Unpublish</button>}
        </>}
      </div>
    </section>
  );
}

function NoteDialog({ title, label, required, onClose, onOk }: { title: string; label: string; required?: boolean; onClose: () => void; onOk: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Dialog title={title} onClose={onClose} footer={<><button type="button" className={s.btn} onClick={onClose}>Cancel</button><button type="button" className={`${s.btn} ${s.btnRed}`} disabled={required && note.trim().length < 3} onClick={() => onOk(note.trim())}>Confirm</button></>}>
      <label className={s.field}><span>{label}</span><textarea className={s.textarea} rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus /></label>
    </Dialog>
  );
}

// ---- images ---------------------------------------------------------------------

function Images({ form, setForm, photos, locked }: { form: Form; setForm: (f: Form) => void; photos: any[]; locked: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = async (file: File | undefined, target: 'featured' | 'extra') => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const jpeg = await imageCompression(file, { maxSizeMB: 4, maxWidthOrHeight: 2400, useWebWorker: true, fileType: 'image/jpeg', initialQuality: 0.85 });
      const key = await articleImageUpload(new File([jpeg], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
      if (target === 'featured') setForm({ ...form, imageFileId: key });
      else setForm({ ...form, supportingImages: [...form.supportingImages, { fileId: key, caption: '' }] });
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const pick = (key: string, target: 'featured' | 'extra') => {
    if (target === 'featured') setForm({ ...form, imageFileId: key });
    else if (!form.supportingImages.some((x) => x.fileId === key)) setForm({ ...form, supportingImages: [...form.supportingImages, { fileId: key, caption: '' }] });
  };
  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>Photos</h2>
      <fieldset disabled={locked || busy} className={s.form} style={{ border: 0, padding: 0, margin: 0 }}>
        <div>
          <div className={s.field}><span>Featured image</span></div>
          {form.imageFileId ? (
            <div className={s.pickedImg}>
              <img src={articleImageUrl(form.imageFileId)} alt="" />
              <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                <input className={s.input} value={form.imageCaption} onChange={(e) => setForm({ ...form, imageCaption: e.target.value })} placeholder="Caption and credit" aria-label="Featured image caption" />
                <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setForm({ ...form, imageFileId: '' })}>Remove featured image</button>
              </div>
            </div>
          ) : <p className={s.small} style={{ margin: '4px 0 0' }}>None chosen.</p>}
        </div>
        <div>
          <div className={s.field}><span>Case photos published with consent</span></div>
          {photos.length === 0 ? <p className={s.small} style={{ margin: '4px 0 0' }}>None yet. Publish a photo with consent in the case&rsquo;s Media &amp; Documents tab first.</p> : (
            <div className={s.pickGrid}>
              {photos.map((p) => (
                <div key={p.$id} className={s.pickItem}>
                  <img src={articleImageUrl(p.publicKey)} alt={p.caption || p.filename} />
                  <div className={s.mediaActions}>
                    <button type="button" className={s.btn} onClick={() => pick(p.publicKey, 'featured')}>Featured</button>
                    <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => pick(p.publicKey, 'extra')}>+ Additional</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={s.formRow}>
          <label className={s.btn}>Upload featured image<input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], 'featured')} /></label>
          <label className={s.btn}>Upload additional photo<input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], 'extra')} /></label>
        </div>
        <p className={s.small} style={{ margin: 0 }}>Uploads here go straight to the public website. Use them only for photos that are safe to publish (e.g. the area near the railway station). Photos of the people in the case must come from the consented case photos above.</p>
        {form.supportingImages.length > 0 && (
          <div>
            <div className={s.field}><span>Additional photos</span></div>
            {form.supportingImages.map((img, i) => (
              <div key={img.fileId} className={s.pickedImg} style={{ marginTop: 8 }}>
                <img src={articleImageUrl(img.fileId)} alt="" />
                <div style={{ flex: 1, display: 'grid', gap: 8 }}>
                  <input className={s.input} value={img.caption} aria-label={`Caption for additional photo ${i + 1}`} placeholder={`Caption (place with [[image:${i + 1}]])`}
                    onChange={(e) => setForm({ ...form, supportingImages: form.supportingImages.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)) })} />
                  <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={() => setForm({ ...form, supportingImages: form.supportingImages.filter((_, j) => j !== i) })}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {busy && <p className={s.small}>Uploading…</p>}
        {error && <p className={s.error}>{error}</p>}
      </fieldset>
    </section>
  );
}

// ---- AI writing -----------------------------------------------------------------

function AiPanel({ caseId, locked, onUse }: { caseId: string; locked: boolean; onUse: (patch: Partial<Form>) => void }) {
  const [format, setFormat] = useState('article_en');
  const [internal, setInternal] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const generate = async () => {
    setBusy(true); setError(''); setResult(null);
    try { setResult(await reunionApi(`/cases/${caseId}/ai`, { method: 'POST', body: { format, internal } })); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const d = result?.draft || {};
  const text = result?.shape === 'article' ? [d.headline, d.subheadline, d.body].filter(Boolean).join('\n\n') : d.text || '';
  const useIt = () => {
    if (result.shape === 'article') onUse({ title: d.headline || '', sideHeader: d.subheadline || '', content: d.body || '', seoTitle: d.seoTitle || '', metaDescription: d.metaDescription || '', keywords: d.keywords || '', socialDescription: d.socialDescription || '' });
    else onUse({ content: d.text || '' });
  };
  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>AI writing assistant</h2>
      <p className={s.small} style={{ marginTop: 0 }}>Drafts are written only from the case facts marked public, with verified and unverified details labelled. The AI is told never to invent quotes or say the family has been found. Nothing is saved or published until you choose to.</p>
      <div className={s.form}>
        <label className={s.field}><span>Format</span><select className={s.select} value={format} onChange={(e) => setFormat(e.target.value)}>{AI_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
        <label className={s.check}><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> <span>Internal draft: use all case facts, including private ones. <b className={s.private}>Never publish an internal draft.</b></span></label>
        <button type="button" className={`${s.btn} ${s.btnRed}`} onClick={generate} disabled={busy}>{busy ? 'Writing…' : 'Generate draft'}</button>
      </div>
      {error && <p className={s.error}>{error}</p>}
      {result && (
        <div style={{ marginTop: 14 }}>
          <div className={s.small} style={{ marginBottom: 6 }}>{result.label} · from {result.factsUsed} fact{result.factsUsed === 1 ? '' : 's'}{result.internal ? <> · <b className={s.private}>INTERNAL: DO NOT PUBLISH</b></> : ''}</div>
          {result.warnings.length > 0 && <div className={s.error} style={{ marginTop: 0, marginBottom: 8 }}><b>Check before using:</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{result.warnings.map((w: string) => <li key={w}>{w}</li>)}</ul></div>}
          <pre className={s.aiOut}>{text}</pre>
          <div className={s.mediaActions}>
            {!result.internal && <button type="button" className={s.btn} disabled={locked} onClick={useIt}>{result.shape === 'article' ? 'Use in editor' : 'Use as article body'}</button>}
            <button type="button" className={`${s.btn} ${s.btnGhost}`} onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ } }}>{copied ? 'Copied' : 'Copy text'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
