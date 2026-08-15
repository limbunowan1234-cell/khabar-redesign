'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CONTEST_VOTE_CUTOFF_MS } from '@/lib/certRanking';
import { timeAgo } from '@/components/Byline';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': PROJECT };
const HJ = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };
const DB = 'Khabar_db';

// Contest-wide discussion reuses the same comments collection articles use,
// scoped under this fixed pseudo-article id instead of a real article.
const DISCUSSION_ID = 'contest-2026-discussion';

function getInitials(name: string): string {
  if (!name) return 'KD';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

async function fetchDiscussion() {
  const res = await fetch(
    ENDPOINT + '/databases/' + DB + '/collections/comments/documents?queries[]=' +
    encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [DISCUSSION_ID] })) +
    '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })) +
    '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [200] })),
    { headers: H, credentials: 'include' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

async function postDiscussionComment(userId: string, authorName: string, commentText: string) {
  const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents', {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({
      documentId: 'unique()',
      data: { articleId: DISCUSSION_ID, userId, authorName, commentText, parentCommentId: null, avatarUrl: '', createdAt: new Date().toISOString() }
    })
  });
  if (!res.ok) throw new Error('Failed to post');
  return res.json();
}

async function deleteDiscussionComment(commentId: string) {
  await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents/' + commentId, {
    method: 'DELETE', headers: H, credentials: 'include'
  });
}

export default function ContestClient({ initialEntries = [] }: { initialEntries?: any[] }) {
  const [entries, setEntries] = useState<any[]>(initialEntries);
  const [loading, setLoading] = useState(initialEntries.length === 0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'discussion'>('list');
  const [user, setUser] = useState<any>(null);

  const [discussion, setDiscussion] = useState<any[]>([]);
  const [discussionText, setDiscussionText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const userRes = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        if (userRes.ok) setUser(await userRes.json());
      } catch {}

      try {
        const res = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'isContestEntry', values: [true] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
          { headers: H, credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          const docs = data.documents || [];
          const withVotes = await Promise.all(docs.map(async (a: any) => {
            try {
              const likesRes = await fetch(
                ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' +
                encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [a.$id] })) +
                '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [2000] })),
                { headers: H, credentials: 'include' }
              );
              if (likesRes.ok) {
                const likesData = await likesRes.json();
                let commentCount = 0;
              try {
                const commentsRes = await fetch(
                  ENDPOINT + "/databases/" + DB + "/collections/comments/documents?queries[]=" +
                  encodeURIComponent(JSON.stringify({ method: "equal", attribute: "articleId", values: [a.$id] })) +
                  "&queries[]=" + encodeURIComponent(JSON.stringify({ method: "limit", values: [1] })),
                  { headers: H, credentials: "include" }
                );
                if (commentsRes.ok) {
                  const commentsData = await commentsRes.json();
                  commentCount = commentsData.total || 0;
                }
              } catch {}
              const articleLikes = (likesData.documents || []).filter((l: any) => !l.commentId && new Date(l.$createdAt).getTime() < CONTEST_VOTE_CUTOFF_MS).length;
              return { ...a, _votes: articleLikes, _comments: commentCount };
              }
            } catch {}
            return { ...a, _votes: 0 };
          }));

          // Results are final: keep only each author's best-scoring entry so
          // no one occupies multiple leaderboard spots. Matches the same
          // dedup rule used for certificates (lib/certRanking.ts).
          const scoreOf = (a: any) => (a.views || 0) * 0.5 + (a._votes || 0) * 1 + (a._comments || 0) * 3;
          const bestPerAuthor = new Map<string, any>();
          for (const a of withVotes) {
            const key = a.submitterId || a.$id;
            const existing = bestPerAuthor.get(key);
            if (!existing || scoreOf(a) > scoreOf(existing)) bestPerAuthor.set(key, a);
          }
          const deduped = Array.from(bestPerAuthor.values()).sort((a, b) => scoreOf(b) - scoreOf(a));
          if (deduped.length > 0) setEntries(deduped);
        }
      } catch {}

      try { setDiscussion(await fetchDiscussion()); } catch {}

      setLoading(false);
    }
    load();
  }, []);

  async function handlePostDiscussion() {
    if (!user) { window.location.href = '/auth'; return; }
    if (!discussionText.trim()) return;
    setPosting(true);
    try {
      await postDiscussionComment(user.$id, user.name || 'User', discussionText.trim());
      setDiscussionText('');
      setDiscussion(await fetchDiscussion());
    } catch { alert('Could not post. Try again.'); }
    setPosting(false);
  }

  async function handleDeleteDiscussion(commentId: string) {
    if (!confirm('Delete this message?')) return;
    try {
      await deleteDiscussionComment(commentId);
      setDiscussion(await fetchDiscussion());
    } catch {}
  }

  function calcScore(a: any): number {
    return (a.views || 0) * 0.5 + (a._votes || 0) * 1 + (a._comments || 0) * 3;
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #c41e3a, #a01830)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <img src="/assets/logo.png" alt="logo" style={{ width: '70px', height: '70px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', marginBottom: '20px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '16px', fontSize: '14px' }}>Loading...</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* HEADER */}
      <header style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#c41e3a', color: 'white', padding: '12px 20px', borderBottom: '3px solid #f5c518', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/assets/logo.png" alt="logo" style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span style={{ fontWeight: '800', fontSize: '18px' }}>खबर दार्जिलिंग</span>
          </Link>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/" style={{ textDecoration: 'none' }}><button style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>← Home</button></Link>
            <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '15px' }}>{isDarkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </header>

      {/* HERO BANNER */}
      <div style={{ position: "relative", width: "100%", backgroundColor: "#a01830", overflow: "hidden" }}>
        <img
          src="/assets/contest-hero.jpg"
          alt="Khabar Darjeeling Story Contest 2026"
          style={{ width: "100%", maxHeight: "500px", objectFit: "cover", display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,0.75) 100%)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "30px 20px", textAlign: "center", color: "white" }}>
          <div style={{ fontSize: "36px", fontWeight: "800", color: "#f5c518" }}>Results Are In!</div>
          <p style={{ margin: "8px 0 20px", fontSize: "16px", opacity: 0.95 }}>Theme: <strong>Life After Election</strong> • ₹10,000 Prize Pool</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#results" style={{ textDecoration: "none" }}>
              <button style={{ backgroundColor: "#f5c518", color: "#1a1a1a", border: "none", padding: "12px 28px", borderRadius: "30px", fontWeight: "800", fontSize: "15px", cursor: "pointer" }}>🏆 View Final Results</button>
            </a>
          </div>
        </div>
      </div>

      {/* INFO CARDS */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { icon: '🏆', label: 'Prize Pool', value: '₹10,000' },
            { icon: '📅', label: 'Deadline', value: 'July 31, 2026' },
            { icon: '🎉', label: 'Results', value: 'Aug 15, 2026' },
            { icon: '👥', label: 'Entries', value: entries.length + ' Stories' },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>{card.icon}</div>
              <div style={{ fontSize: '11px', color: isDarkMode ? '#aaa' : '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* RESULTS ANNOUNCEMENT */}
        <div style={{ background: 'linear-gradient(135deg, #c41e3a, #a01830)', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 16px rgba(196,30,58,0.25)', marginBottom: '24px', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🎉</div>
          <h2 style={{ fontSize: '19px', fontWeight: '800', margin: '0 0 10px' }}>The Story Contest 2026 results are out!</h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', opacity: 0.95, margin: '0 auto', maxWidth: '640px' }}>
            Please visit your <strong>Profile</strong> page to collect your certificate. If you placed in the <strong>Top 3</strong>, please contact us to claim your prize.
            Everyone who took part did wonderfully — best of luck for your future writing!
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '18px' }}>
            <Link href="/profile" style={{ textDecoration: 'none' }}>
              <button style={{ backgroundColor: '#f5c518', color: '#1a1a1a', border: 'none', padding: '10px 22px', borderRadius: '24px', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>🎓 Collect Your Certificate</button>
            </Link>
            <Link href="/contact" style={{ textDecoration: 'none' }}>
              <button style={{ backgroundColor: 'transparent', color: 'white', border: '2px solid rgba(255,255,255,0.6)', padding: '10px 22px', borderRadius: '24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>✉️ Contact Us</button>
            </Link>
          </div>
        </div>

        {/* TABS */}
        <div id="results" style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '2px solid ' + (isDarkMode ? '#2a2a2a' : '#e5e5e5'), scrollMarginTop: '70px' }}>
          {([
            ['list', '📋 Results List'],
            ['discussion', '💬 Discussion'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} style={{
              padding: '12px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: '14px', fontWeight: '800',
              color: activeTab === key ? '#c41e3a' : (isDarkMode ? '#888' : '#999'),
              borderBottom: activeTab === key ? '3px solid #c41e3a' : '3px solid transparent',
              marginBottom: '-2px',
            }}>{label}</button>
          ))}
        </div>

        {/* RESULTS LIST */}
        {activeTab === 'list' && (
          entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <p style={{ fontSize: '18px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', margin: 0 }}>No entries found.</p>
            </div>
          ) : (
            <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '40px', overflow: 'hidden' }}>
              {entries.map((a, i) => {
                const author = a.submitterName || a.authorName || 'Anonymous';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                  <Link key={a.$id} href={'/article/' + a.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', borderBottom: i < entries.length - 1 ? '1px solid ' + (isDarkMode ? '#2a2a2a' : '#f0f0f0') : 'none', cursor: 'pointer' }}>
                      <div style={{ width: '30px', flexShrink: 0, textAlign: 'center', fontSize: medal ? '20px' : '14px', fontWeight: '800', color: medal ? undefined : (isDarkMode ? '#666' : '#aaa') }}>
                        {medal || (i + 1)}
                      </div>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>{getInitials(author)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                        <div style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#999' }}>{author}</div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#f5c518', flexShrink: 0 }}>⭐ {Math.round(calcScore(a)).toLocaleString()}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* DISCUSSION */}
        {activeTab === 'discussion' && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '16px' }}>
              <textarea
                value={discussionText}
                onChange={(e) => setDiscussionText(e.target.value)}
                placeholder={user ? "Share what went well, what didn't, or any thoughts on the contest..." : 'Login to join the discussion'}
                disabled={!user}
                rows={3}
                style={{ width: '100%', border: '1px solid ' + (isDarkMode ? '#333' : '#e5e5e5'), borderRadius: '8px', padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', backgroundColor: isDarkMode ? '#121212' : '#fafafa', color: isDarkMode ? '#fff' : '#1a1a1a', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                {user ? (
                  <button onClick={handlePostDiscussion} disabled={posting || !discussionText.trim()} style={{ backgroundColor: (posting || !discussionText.trim()) ? '#999' : '#c41e3a', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '20px', cursor: (posting || !discussionText.trim()) ? 'default' : 'pointer', fontWeight: '700', fontSize: '13px' }}>
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                ) : (
                  <Link href="/auth" style={{ color: '#c41e3a', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}>Login to comment →</Link>
                )}
              </div>
            </div>

            {discussion.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <p style={{ fontSize: '14px', color: isDarkMode ? '#888' : '#999', margin: 0 }}>No comments yet — start the conversation!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {discussion.map((c) => (
                  <div key={c.$id} style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{getInitials(c.authorName || 'User')}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{c.authorName || 'User'}</span>
                        <span style={{ fontSize: '11px', color: isDarkMode ? '#777' : '#999' }}>{timeAgo(c.$createdAt)}</span>
                        {user && c.userId === user.$id && (
                          <button onClick={() => handleDeleteDiscussion(c.$id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: isDarkMode ? '#666' : '#bbb', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: isDarkMode ? '#ccc' : '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.commentText}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
