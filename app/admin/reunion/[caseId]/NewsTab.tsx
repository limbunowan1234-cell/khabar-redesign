'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ARTICLE_STATUS, fmtWhen, reunionApi } from '@/lib/reunion';
import s from '../Reunion.module.css';

// Every article written about this case, newest first, with its place in
// the Draft -> Editorial Review -> Approved -> Published workflow.
export default function NewsTab({ c }: { c: any }) {
  const [list, setList] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    reunionApi<{ documents: any[] }>(`/cases/${c.$id}/articles`).then((r) => setList(r.documents)).catch((e) => setError(e.message));
  }, [c.$id]);
  const base = `/admin/reunion/${c.caseCode}/articles`;

  return (
    <section className={s.panel}>
      <h2 className={s.panelTitle}>Case newsroom <Link className={`${s.btn} ${s.btnRed}`} href={`${base}/new`}>✎ Create Article</Link></h2>
      <p className={s.notice} style={{ marginBottom: 12 }}>Write as many articles as the case needs: the first appeal, new information from residents, progress updates, and later the reunion story. Each one goes Draft → Editorial Review → Approved → Published. Only an admin can approve and publish, and only with a recorded story consent. Publishing an article never shows the private case record.</p>
      {error && <p className={s.error}>{error}</p>}
      {list === null ? <p className={s.small}>Loading…</p> : list.length === 0 ? <p className={s.small}>No articles yet.</p> : (
        <div className={s.list}>
          {list.map((a) => {
            const st = ARTICLE_STATUS[a.status] || { label: a.status, tone: 'new' };
            return (
              <Link key={a.$id} href={`${base}/${a.$id}`} className={s.row} style={{ gridTemplateColumns: 'minmax(0,1fr) 180px 160px' }}>
                <span><span className={s.rowTitle}>{a.title}</span><span className={s.rowMeta}>{a.sideHeader || 'No subheadline'}{a.authorName ? ` · by ${a.authorName}` : ''}</span></span>
                <span className={s.small}>{a.status === 'published' ? `Published ${fmtWhen(a.publishedAt, false)}` : `Updated ${fmtWhen(a.updatedAt, false)}`}</span>
                <span style={{ justifySelf: 'end' }}><span className={`${s.pill} ${s['t_' + st.tone]}`}>{st.label}</span></span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
