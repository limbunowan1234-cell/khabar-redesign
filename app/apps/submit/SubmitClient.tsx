'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from '../apps.module.css';
import AppCard, { AppIcon } from '../AppCard';
import { getCurrentUser, getWorkerAuthToken } from '@/lib/appwrite';
import { DOWNLOAD_CATEGORIES, WORKER_URL, appHref, imageUrl, type DownloadItem } from '@/lib/downloadCategories';

const MAX_SHOTS = 8;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Shot = { key: string; fileId: string | null; local: string; error?: string };

async function uploadImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(file.name + ' is not an image');
  if (file.size > MAX_IMAGE_BYTES) throw new Error(file.name + ' is over 10MB');
  const token = await getWorkerAuthToken();
  if (!token) throw new Error('Your login expired -- please log in again');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(WORKER_URL + '/cdn/articles', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.fileId) throw new Error(data.error || 'Upload failed');
  return data.fileId as string;
}

const isUrl = (s: string) => {
  try { const u = new URL(s.trim()); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
};

export default function SubmitClient() {
  const [auth, setAuth] = useState<'checking' | 'out' | 'in'>('checking');
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [category, setCategory] = useState<string>('apps');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [developerEmail, setDeveloperEmail] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [appStoreUrl, setAppStoreUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [iconFileId, setIconFileId] = useState('');
  const [iconBusy, setIconBusy] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [dragOn, setDragOn] = useState(false);
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [mine, setMine] = useState<DownloadItem[]>([]);
  const iconInput = useRef<HTMLInputElement>(null);
  const shotInput = useRef<HTMLInputElement>(null);

  async function loadMine() {
    try {
      const token = await getWorkerAuthToken();
      if (!token) return;
      const res = await fetch(WORKER_URL + '/downloads/mine', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setMine((await res.json()).documents || []);
    } catch {}
  }

  useEffect(() => {
    (async () => {
      const token = await getWorkerAuthToken().catch(() => null);
      if (!token) { setAuth('out'); return; }
      setAuth('in');
      const u = await getCurrentUser().catch(() => null);
      if (u) {
        setDeveloperName((v) => v || u.name || '');
        setDeveloperEmail((v) => v || u.email || '');
      }
      loadMine();
    })();
  }, []);

  async function pickIcon(file: File | undefined) {
    if (!file) return;
    setError(''); setIconBusy(true);
    try { setIconFileId(await uploadImage(file)); } catch (e: any) { setError(e.message || 'Icon upload failed'); }
    setIconBusy(false);
  }

  async function addShots(files: FileList | File[] | null) {
    if (!files) return;
    const room = MAX_SHOTS - shots.length;
    const list = Array.from(files).slice(0, Math.max(room, 0));
    if (Array.from(files).length > room) setError(`You can add up to ${MAX_SHOTS} screenshots.`);
    else setError('');
    for (const file of list) {
      const key = Math.random().toString(36).slice(2);
      const local = URL.createObjectURL(file);
      setShots((s) => [...s, { key, fileId: null, local }]);
      try {
        const fileId = await uploadImage(file);
        setShots((s) => s.map((x) => (x.key === key ? { ...x, fileId } : x)));
      } catch (e: any) {
        setShots((s) => s.filter((x) => x.key !== key));
        setError(e.message || 'Screenshot upload failed');
      }
    }
  }

  function removeShot(key: string) {
    setShots((s) => s.filter((x) => x.key !== key));
  }

  const uploading = iconBusy || shots.some((s) => !s.fileId);
  const hasLink = [websiteUrl, playStoreUrl, appStoreUrl, externalUrl].some((u) => u.trim());

  function validate(): string {
    if (!title.trim()) return 'Give your app a name.';
    if (!tagline.trim()) return 'Add a one-line tagline.';
    if (description.trim().length < 20) return 'Describe your app in at least a couple of sentences.';
    if (!iconFileId) return 'Upload an app icon.';
    if (!developerName.trim()) return 'Add the developer or team name.';
    if (!hasLink) return 'Add at least one link where people can get your app.';
    for (const [label, u] of [['Website', websiteUrl], ['Google Play', playStoreUrl], ['App Store', appStoreUrl], ['Download link', externalUrl]] as const) {
      if (u.trim() && !isUrl(u)) return label + ' must be a full link starting with https://';
    }
    if (developerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(developerEmail.trim())) return 'That contact email does not look right.';
    if (!agree) return 'Please confirm the declaration at the bottom.';
    return '';
  }

  async function submit() {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setSubmitting(true); setError('');
    try {
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Your login expired -- please log in again');
      const res = await fetch(WORKER_URL + '/downloads/submit', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, tagline, category, description, version,
          developerName, developerEmail,
          websiteUrl: websiteUrl.trim() || null,
          playStoreUrl: playStoreUrl.trim() || null,
          appStoreUrl: appStoreUrl.trim() || null,
          externalUrl: externalUrl.trim() || null,
          iconFileId,
          screenshots: shots.map((s) => s.fileId).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit -- please try again');
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      loadMine();
    } catch (e: any) {
      setError(e.message || 'Could not submit -- please try again');
    }
    setSubmitting(false);
  }

  function another() {
    setDone(false); setTitle(''); setTagline(''); setCategory('apps'); setDescription(''); setVersion('');
    setWebsiteUrl(''); setPlayStoreUrl(''); setAppStoreUrl(''); setExternalUrl(''); setIconFileId(''); setShots([]); setAgree(false); setError('');
  }

  async function withdraw(item: DownloadItem) {
    if (!confirm('Withdraw "' + item.title + '"?')) return;
    try {
      const token = await getWorkerAuthToken();
      if (!token) return;
      await fetch(WORKER_URL + '/downloads/' + item.$id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      loadMine();
    } catch {}
  }

  const preview: DownloadItem = {
    $id: 'preview', slug: null, title: title.trim(), tagline: tagline.trim() || null, category, description: description.trim() || null,
    version: version.trim() || null, iconFileId: iconFileId || null, screenshots: shots.map((s) => s.fileId).filter(Boolean) as string[],
    developerName: developerName.trim() || null, websiteUrl: null, playStoreUrl: null, appStoreUrl: null, featured: false, fileName: null,
    sizeBytes: null, downloadCount: 0, hosted: false, hasDownload: false, createdAt: '',
  };

  return (
    <>
      <section className={styles.hero} style={{ paddingBottom: '74px' }}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Submit your app</p>
          <h1 className={styles.heroTitle}>Share your app with the hills</h1>
          <p className={styles.heroSub}>
            Free to list. Add your icon, screenshots and links &mdash; we review every submission before it goes live, usually within a couple of days.
          </p>
        </div>
      </section>

      <div className={styles.shell}>
        <div className={styles.pull}>
          {auth === 'checking' && <div className={styles.empty}>Loading&hellip;</div>}

          {auth === 'out' && (
            <div className={styles.empty}>
              <span className={styles.emptyEmoji}>🔐</span>
              <strong style={{ display: 'block', fontSize: '18px', color: 'var(--ap-text)', marginBottom: '6px' }}>Log in to submit an app</strong>
              We ask for a free account so every listing has an owner, and so you can track its review.
              <div style={{ marginTop: '18px' }}>
                <Link href="/auth" className={styles.cta}>Log in or sign up</Link>
              </div>
            </div>
          )}

          {auth === 'in' && done && (
            <div className={`${styles.panel} ${styles.success}`}>
              <span className={styles.successEmoji}>🎉</span>
              <h2 className={styles.sectionTitle} style={{ marginBottom: '8px' }}>Submitted for review</h2>
              <p className={styles.sideText} style={{ maxWidth: '46ch', margin: '0 auto 22px' }}>
                Thanks! We&apos;ll check your listing and publish it if everything looks good. You can follow its status below.
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className={styles.cta} onClick={another}>Submit another app</button>
                <Link href="/apps" className={styles.ctaGhost}>Browse the store</Link>
              </div>
            </div>
          )}

          {auth === 'in' && !done && (
            <div className={styles.formGrid}>
              <div className={styles.stack}>
                {error && <div className={`${styles.alert} ${styles.alertErr}`} role="alert" style={{ marginBottom: 0 }}>{error}</div>}

                <section className={styles.fieldset}>
                  <h2 className={styles.legend}>The basics</h2>
                  <p className={styles.legendNote}>What people see first in the store.</p>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="t">App name <span className={styles.req}>*</span></label>
                    <input id="t" className={styles.input} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Swaara" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="tg">Tagline <span className={styles.req}>*</span><span className={styles.counter}>{tagline.length}/120</span></label>
                    <input id="tg" className={styles.input} value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} placeholder="One line on what it does" />
                  </div>
                  <div className={styles.row2}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="c">Category <span className={styles.req}>*</span></label>
                      <select id="c" className={styles.select} value={category} onChange={(e) => setCategory(e.target.value)}>
                        {DOWNLOAD_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="v">Version</label>
                      <input id="v" className={styles.input} value={version} maxLength={50} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 1.0.2" />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="d">Description <span className={styles.req}>*</span><span className={styles.counter}>{description.length}/4000</span></label>
                    <textarea id="d" className={styles.textarea} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} placeholder="What does it do? What makes it useful? Any requirements?" />
                  </div>
                </section>

                <section className={styles.fieldset}>
                  <h2 className={styles.legend}>Pictures</h2>
                  <p className={styles.legendNote}>A square icon (512×512 works best) and up to {MAX_SHOTS} in-app images &mdash; screenshots of the app&apos;s screens. Images only, up to 10MB each.</p>
                  <div className={styles.field}>
                    <label className={styles.label}>App icon <span className={styles.req}>*</span></label>
                    <div className={styles.iconPick}>
                      <div className={styles.iconBox} onClick={() => iconInput.current?.click()} role="button" tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') iconInput.current?.click(); }} aria-label="Choose app icon">
                        {iconFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl(iconFileId)} alt="App icon preview" />
                        ) : iconBusy ? 'Uploading…' : 'Choose icon'}
                      </div>
                      <div>
                        <button type="button" className={styles.ctaGhost} onClick={() => iconInput.current?.click()} disabled={iconBusy}>
                          {iconFileId ? 'Change icon' : 'Upload icon'}
                        </button>
                        {iconFileId && <button type="button" className={styles.linkBtn} style={{ marginLeft: '12px' }} onClick={() => setIconFileId('')}>Remove</button>}
                      </div>
                      <input ref={iconInput} type="file" accept="image/*" hidden onChange={(e) => { pickIcon(e.target.files?.[0]); e.target.value = ''; }} />
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>In-app images <span className={styles.counter}>{shots.length}/{MAX_SHOTS}</span></label>
                    <div
                      className={`${styles.drop} ${dragOn ? styles.dropOn : ''}`}
                      onClick={() => shotInput.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOn(true); }}
                      onDragLeave={() => setDragOn(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOn(false); addShots(e.dataTransfer.files); }}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') shotInput.current?.click(); }}
                    >
                      Drag in-app images here, or <strong style={{ color: 'var(--ap-red)' }}>browse</strong>
                    </div>
                    <input ref={shotInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addShots(e.target.files); e.target.value = ''; }} />
                    {shots.length > 0 && (
                      <div className={styles.thumbs}>
                        {shots.map((s) => (
                          <div key={s.key} className={`${styles.thumb} ${s.fileId ? '' : styles.thumbBusy}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.fileId ? imageUrl(s.fileId) : s.local} alt="Screenshot preview" />
                            <button type="button" className={styles.thumbX} onClick={() => removeShot(s.key)} aria-label="Remove screenshot">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className={styles.fieldset}>
                  <h2 className={styles.legend}>Where to get it</h2>
                  <p className={styles.legendNote}>Add at least one. People are sent to these links &mdash; we don&apos;t host files for community listings.</p>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="pl">Google Play link</label>
                    <input id="pl" className={styles.input} value={playStoreUrl} onChange={(e) => setPlayStoreUrl(e.target.value)} placeholder="https://play.google.com/store/apps/details?id=…" inputMode="url" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="as">App Store link</label>
                    <input id="as" className={styles.input} value={appStoreUrl} onChange={(e) => setAppStoreUrl(e.target.value)} placeholder="https://apps.apple.com/…" inputMode="url" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="ws">Website</label>
                    <input id="ws" className={styles.input} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" inputMode="url" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="ex">Direct download link (APK)</label>
                    <input id="ex" className={styles.input} value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://github.com/you/app/releases/download/…/app.apk" inputMode="url" />
                    <p className={styles.hint}>GitHub Releases or Google Drive work well. Visitors tap Get on this site and are sent to this link.</p>
                  </div>
                </section>

                <section className={styles.fieldset}>
                  <h2 className={styles.legend}>About you</h2>
                  <p className={styles.legendNote}>The developer name is shown publicly. Your contact email stays private &mdash; we only use it to reach you about this listing.</p>
                  <div className={styles.row2}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="dn">Developer / team name <span className={styles.req}>*</span></label>
                      <input id="dn" className={styles.input} value={developerName} maxLength={100} onChange={(e) => setDeveloperName(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="de">Contact email</label>
                      <input id="de" type="email" className={styles.input} value={developerEmail} onChange={(e) => setDeveloperEmail(e.target.value)} />
                    </div>
                  </div>
                  <label className={styles.check} style={{ marginTop: '6px' }}>
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                    <span>I made this app, or I have permission to share it. It contains no malware, and it doesn&apos;t break any law or anyone&apos;s rights. I understand Khabar Darjeeling can remove a listing at any time.</span>
                  </label>
                  <button className={styles.submitBtn} onClick={submit} disabled={submitting || uploading}>
                    {submitting ? 'Submitting…' : uploading ? 'Waiting for uploads…' : 'Submit for review'}
                  </button>
                </section>
              </div>

              <aside className={styles.preview}>
                <p className={styles.previewLabel}>Live preview</p>
                <AppCard item={preview} preview />
                <p className={styles.hint} style={{ marginTop: '10px' }}>This is how your card will look in the store.</p>
              </aside>
            </div>
          )}
        </div>

        {auth === 'in' && mine.length > 0 && (
          <section className={styles.panel} style={{ marginTop: '28px' }}>
            <h2 className={styles.sectionTitle} style={{ marginBottom: '6px' }}>Your submissions</h2>
            <div className={styles.mine}>
              {mine.map((m) => (
                <div key={m.$id} className={styles.mineRow}>
                  <AppIcon item={m} className={styles.rowIcon} />
                  <div className={styles.rowText}>
                    <p className={styles.rowName}>{m.status === 'approved' ? <Link href={appHref(m)}>{m.title}</Link> : m.title}</p>
                    <p className={styles.rowMeta} style={{ whiteSpace: 'normal' }}>
                      {m.status === 'pending' && 'Waiting for review'}
                      {m.status === 'approved' && 'Live in the store'}
                      {m.status === 'rejected' && (m.rejectionReason ? 'Not approved: ' + m.rejectionReason : 'Not approved')}
                    </p>
                  </div>
                  <span className={`${styles.pill} ${m.status === 'approved' ? styles.pillApproved : m.status === 'rejected' ? styles.pillRejected : styles.pillPending}`}>{m.status}</span>
                  {m.status !== 'approved' && <button className={styles.linkBtn} onClick={() => withdraw(m)}>Withdraw</button>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
