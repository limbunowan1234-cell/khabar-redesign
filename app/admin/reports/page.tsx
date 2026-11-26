'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getWorkerAuthToken } from '@/lib/appwrite';

// Moderation for open publishing: everything readers reported from the app
// or site (comments, stories, Flash News, users), with the actions an admin
// needs. Every action is recorded in the moderation log shown below.

const ADMIN_EMAIL = 'nowanad@gmail.com';
const endpoint = 'https://api.khabardarjeeling.in';

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  abuse: 'Harassment',
  hate: 'Hate speech',
  sexual: 'Sexual content',
  violence: 'Violence',
  false: 'False / misleading',
  other: 'Other',
};

type Report = {
  target_type: 'comment' | 'article' | 'user';
  target_id: string;
  count: number;
  reasons: string;
  first_at: string;
  last_at: string;
  comment_text?: string | null;
  comment_author?: string | null;
  comment_user_id?: string | null;
  comment_article_id?: string | null;
  article_title?: string | null;
  article_slug?: string | null;
  article_submitter_id?: string | null;
  article_submitter_name?: string | null;
  article_kind?: string | null;
  article_status?: string | null;
  user_name?: string | null;
  user_labels?: string | null;
};

type LogRow = { id: string; admin_name: string | null; action: string; target_type: string; target_id: string; note: string | null; created_at: string };

const btn = (bg: string, color = 'white') => ({
  padding: '7px 13px',
  borderRadius: '999px',
  border: 'none',
  background: bg,
  color,
  fontWeight: 700,
  fontSize: '12px',
  cursor: 'pointer',
});

export default function AdminReportsPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'open' | 'actioned' | 'dismissed'>('open');
  const [reports, setReports] = useState<Report[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(endpoint + '/auth/me', { credentials: 'include' });
        if (!res.ok) return setAllowed(false);
        const data = await res.json();
        const labels = data.labels || [];
        setAllowed(data.email?.toLowerCase() === ADMIN_EMAIL || labels.includes('admin'));
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const authed = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = await getWorkerAuthToken();
    const res = await fetch(endpoint + path, {
      ...init,
      headers: { Authorization: 'Bearer ' + token, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
    return data;
  }, []);

  const load = useCallback(async () => {
    try {
      const [r, l] = await Promise.all([authed('/reports?status=' + tab), authed('/auth/admin/moderation-log?limit=50')]);
      setReports(r.documents || []);
      setLog(l.documents || []);
    } catch (e: any) {
      setMsg(e.message);
    }
  }, [authed, tab]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  async function act(key: string, steps: Array<() => Promise<unknown>>, done: string) {
    setBusy(key);
    setMsg('');
    try {
      for (const step of steps) await step();
      setMsg(done);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    }
    setBusy(null);
  }

  const close = (r: Report, status: 'actioned' | 'dismissed', note?: string) => () =>
    authed('/reports', { method: 'PATCH', body: JSON.stringify({ targetType: r.target_type, targetId: r.target_id, status, note }) });
  const suspend = (userId: string, note: string) => () =>
    authed('/auth/admin/suspend', { method: 'POST', body: JSON.stringify({ userId, suspended: true, note }) });

  if (allowed === null) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Loading…</div>;
  if (!allowed)
    return (
      <div style={{ padding: 40, fontFamily: 'system-ui' }}>
        Admins only. <Link href="/admin">Back to admin</Link>
      </div>
    );

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#0f4c5c', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 18 }}>🚩 Reports &amp; moderation</strong>
        <Link href="/admin" style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>← Admin</Link>
      </div>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>
        <p style={{ margin: '0 0 16px', color: '#4b5563', fontSize: 14, maxWidth: '70ch' }}>
          Anyone can publish instantly, so this is where problems get handled. A comment reported by 3 or more people is hidden until
          you dismiss or act on it. The community rules promise a review within 24 hours.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['open', 'actioned', 'dismissed'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={btn(tab === t ? '#0f4c5c' : '#e5e7eb', tab === t ? 'white' : '#111827')}>
              {t === 'open' ? 'Open' : t === 'actioned' ? 'Actioned' : 'Dismissed'}
            </button>
          ))}
        </div>

        {msg && <div style={{ background: '#eef6f8', color: '#0f4c5c', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 14 }}>{msg}</div>}

        {reports.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 12, padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
            {tab === 'open' ? 'No open reports. 🎉' : 'Nothing here yet.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map((r) => {
              const key = r.target_type + ':' + r.target_id;
              const reasons = (r.reasons || '').split(',').map((x) => REASON_LABELS[x] || x).join(', ');
              const isFlash = r.article_kind === 'flash';
              return (
                <section key={key} style={{ background: 'white', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: '5px solid ' + (r.count >= 3 ? '#c41e3a' : '#f5c518') }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ background: '#111827', color: 'white', padding: '2px 9px', borderRadius: 999, fontWeight: 800, textTransform: 'uppercase' }}>
                      {r.target_type === 'article' ? (isFlash ? 'Flash News' : 'Story') : r.target_type}
                    </span>
                    <span style={{ fontWeight: 700, color: '#c41e3a' }}>{r.count} report{r.count === 1 ? '' : 's'}</span>
                    <span style={{ color: '#4b5563' }}>{reasons}</span>
                    <span style={{ color: '#9ca3af', marginLeft: 'auto' }}>Last {new Date(r.last_at.replace(' ', 'T') + 'Z').toLocaleString('en-IN')}</span>
                  </div>

                  {r.target_type === 'comment' && (
                    <p style={{ margin: '0 0 10px', fontSize: 15 }}>
                      <strong>{r.comment_author || 'Unknown'}:</strong> {r.comment_text ?? <em style={{ color: '#9ca3af' }}>(already deleted)</em>}
                    </p>
                  )}
                  {r.target_type === 'article' && (
                    <p style={{ margin: '0 0 10px', fontSize: 15 }}>
                      {r.article_title ? (
                        <>
                          <Link href={'/article/' + (r.article_slug || r.target_id)} target="_blank" style={{ fontWeight: 700, color: '#111827' }}>{r.article_title}</Link>
                          <span style={{ color: '#6b7280' }}> · by {r.article_submitter_name || 'unknown'} · {r.article_status}</span>
                        </>
                      ) : (
                        <em style={{ color: '#9ca3af' }}>(already deleted)</em>
                      )}
                    </p>
                  )}
                  {r.target_type === 'user' && (
                    <p style={{ margin: '0 0 10px', fontSize: 15 }}>
                      <strong>{r.user_name || r.target_id}</strong>
                      {(r.user_labels || '').includes('suspended') && <span style={{ color: '#c41e3a', fontWeight: 700 }}> · suspended</span>}
                    </p>
                  )}

                  {tab === 'open' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button disabled={busy === key} style={btn('#e5e7eb', '#111827')} onClick={() => act(key, [close(r, 'dismissed')], 'Dismissed. A hidden comment is visible again.')}>
                        Dismiss
                      </button>
                      {r.target_type === 'comment' && r.comment_text != null && (
                        <button disabled={busy === key} style={btn('#c41e3a')} onClick={() => act(key, [() => authed('/comments/' + r.target_id, { method: 'DELETE' }), close(r, 'actioned', 'comment deleted')], 'Comment deleted.')}>
                          Delete comment
                        </button>
                      )}
                      {r.target_type === 'article' && r.article_title && (
                        <>
                          <button disabled={busy === key} style={btn('#b45309')} onClick={() => act(key, [() => authed('/articles/' + r.target_id, { method: 'PATCH', body: JSON.stringify({ status: 'draft', rejectionReason: 'Removed after reports: ' + reasons }) }), close(r, 'actioned', 'unpublished')], 'Unpublished (kept as a draft for the author).')}>
                            Unpublish
                          </button>
                          <button disabled={busy === key} style={btn('#c41e3a')} onClick={() => { if (window.confirm('Delete this post permanently?')) act(key, [() => authed('/articles/' + r.target_id, { method: 'DELETE' }), close(r, 'actioned', 'deleted')], 'Post deleted.'); }}>
                            Delete
                          </button>
                        </>
                      )}
                      {(r.comment_user_id || r.article_submitter_id || r.target_type === 'user') && (
                        <button disabled={busy === key} style={btn('#111827')} onClick={() => {
                          const uid = r.comment_user_id || r.article_submitter_id || r.target_id;
                          act(key, [suspend(uid, 'After reports: ' + reasons), close(r, 'actioned', 'user suspended')], 'User suspended: they can no longer post, comment or upload.');
                        }}>
                          Suspend author
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <h2 style={{ fontSize: 18, margin: '32px 0 10px' }}>Moderation log</h2>
        <div style={{ background: 'white', borderRadius: 12, overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>When</th>
                <th style={{ padding: '8px 12px' }}>Admin</th>
                <th style={{ padding: '8px 12px' }}>Action</th>
                <th style={{ padding: '8px 12px' }}>Item</th>
                <th style={{ padding: '8px 12px' }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: '#6b7280' }}>No moderation actions yet.</td></tr>
              ) : (
                log.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{new Date(l.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-IN')}</td>
                    <td style={{ padding: '8px 12px' }}>{l.admin_name || '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{l.action.replace(/_/g, ' ')}</td>
                    <td style={{ padding: '8px 12px' }}>{l.target_type} <code style={{ fontSize: 11, color: '#6b7280' }}>{l.target_id.slice(0, 8)}</code></td>
                    <td style={{ padding: '8px 12px', color: '#4b5563' }}>{l.note || ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
