'use client';

import { useEffect, useState } from 'react';
import type { ReunionViewer } from '../ReunionShell';
import { publicMediaUrl, reunionApi } from '@/lib/reunion';
import s from '../Reunion.module.css';

// Settings → Public appeal page. The case team writes the public headline and
// story; an admin chooses the public photo and switches the page on, which the
// Worker allows only while a story consent is active. Only facts marked public
// appear on the page.
export default function PublicPanel({ c, viewer, onSaved }: { c: any; viewer: ReunionViewer; onSaved: () => Promise<void> }) {
  const [headline, setHeadline] = useState(c.publicHeadline || '');
  const [story, setStory] = useState(c.publicStory || '');
  const [photoId, setPhotoId] = useState(c.publicPhotoMediaId || '');
  const [photos, setPhotos] = useState<any[]>([]);
  const [storyConsent, setStoryConsent] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const publicFacts = (c.facts || []).filter((f: any) => f.isPublic).length;
  const url = `/family-reunion/${String(c.caseCode).toLowerCase()}`;

  useEffect(() => {
    Promise.all([reunionApi<{ documents: any[] }>(`/cases/${c.$id}/media`), reunionApi<{ documents: any[] }>(`/cases/${c.$id}/consents`)])
      .then(([m, k]) => {
        setPhotos(m.documents.filter((x) => x.publicKey));
        setStoryConsent(k.documents.some((x) => !x.withdrawnAt && ['public_story', 'both'].includes(x.scope)));
      })
      .catch((e) => setMsg({ err: e.message }));
  }, [c.$id]);

  const act = async (body: Record<string, unknown>, ok: string) => {
    setMsg({});
    try { await reunionApi(`/cases/${c.$id}`, { method: 'PATCH', body }); await onSaved(); setMsg({ ok }); } catch (e: any) { setMsg({ err: e.message }); }
  };
  const saveText = () => act(viewer.isAdmin ? { publicHeadline: headline, publicStory: story, publicPhotoMediaId: photoId || null } : { publicHeadline: headline, publicStory: story }, 'Public page text saved.');

  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>Public appeal page
        <span>{c.publicEnabled ? <span className={`${s.pill} ${s.t_public}`}>Live</span> : <span className={`${s.pill} ${s.t_off}`}>Off</span>}</span>
      </h2>
      <ul className={s.checklist}>
        <li className={storyConsent ? s.ok : s.todo}>{storyConsent ? 'Story consent recorded' : 'No active story consent: record one in Media & Documents'}</li>
        <li className={publicFacts ? s.ok : s.todo}>{publicFacts ? `${publicFacts} detail${publicFacts === 1 ? '' : 's'} marked public` : 'No details marked public yet (Personal Information / Investigation)'}</li>
        <li className={headline.trim() && story.trim() ? s.ok : s.todo}>{headline.trim() && story.trim() ? 'Public headline and story written' : 'Write a public headline and story below'}</li>
        <li className={photoId ? s.ok : s.todo}>{photoId ? 'Public photo chosen' : 'No public photo (optional; needs a photo published with consent)'}</li>
      </ul>
      <div className={s.form} style={{ marginTop: 12 }}>
        <label className={s.field}><span>Public headline</span><input className={s.input} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={300} placeholder={c.title} /></label>
        <label className={s.field}><span>Public story</span><textarea className={s.textarea} rows={6} value={story} onChange={(e) => setStory(e.target.value)} maxLength={20000} /><small>Shown on the public page. Only what the subject agreed to share. Attribute details she remembers; never include addresses, phone numbers or private matters.</small></label>
        <label className={s.field}><span>Public photo {viewer.isAdmin ? '' : '(admin)'}</span>
          <select className={s.select} value={photoId} onChange={(e) => setPhotoId(e.target.value)} disabled={!viewer.isAdmin}>
            <option value="">No photo</option>
            {photos.map((p) => <option key={p.$id} value={p.$id}>{p.caption || p.filename}</option>)}
          </select>
        </label>
        {photoId && photos.find((p) => p.$id === photoId) && <img src={publicMediaUrl(photos.find((p) => p.$id === photoId).publicKey)} alt="" style={{ width: 160, borderRadius: 10 }} />}
        <div className={s.mediaActions}>
          <button type="button" className={`${s.btn} ${s.btnRed}`} onClick={saveText}>Save public page</button>
          {viewer.isAdmin && (c.publicEnabled
            ? <button type="button" className={s.btn} onClick={() => act({ publicEnabled: false }, 'Public page switched off.')}>Switch page off</button>
            : <button type="button" className={s.btn} disabled={!storyConsent} onClick={() => act({ publicEnabled: true }, 'Public page is live.')}>Switch page on</button>)}
          {c.publicEnabled ? <a className={`${s.btn} ${s.btnGhost}`} href={url} target="_blank" rel="noopener noreferrer">View public page ↗</a> : null}
        </div>
        {(msg.ok || msg.err) && <p className={msg.err ? s.error : s.notice} style={{ margin: 0 }}>{msg.err || msg.ok}</p>}
      </div>
    </section>
  );
}
