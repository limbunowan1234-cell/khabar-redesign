'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CONTEST_VOTE_CUTOFF_MS } from '@/lib/certRanking';
import { timeAgo } from '@/components/Byline';
import { getCommentLikes, toggleCommentLike, getWorkerAuthToken } from '@/lib/appwrite';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': PROJECT };
const HJ = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };
const DB = 'Khabar_db';
const ADMIN_EMAIL = 'nowanad@gmail.com';
// Week 10+16 of the Cloudflare migration (see cloudflare/README.md): the
// entries list, likes, discussion comments, and contest_settings (pinned
// comment) below all read from the Worker. Posting/deleting a comment and
// pinning one both still write to Appwrite first (shadow-written into D1
// after), since the admin pin action is a server-side route, not this
// client component.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

// Contest-wide discussion reuses the same comments collection articles use,
// scoped under this fixed pseudo-article id instead of a real article.
const DISCUSSION_ID = 'contest-2026-discussion';

function getInitials(name: string): string {
  if (!name) return 'KD';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

async function fetchDiscussion() {
  const res = await fetch(WORKER_URL + '/comments?articleId=' + encodeURIComponent(DISCUSSION_ID));
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

// Shadow-writes into D1 using Appwrite's real document id -- same
// reasoning as ArticleClient.tsx's shadowWriteComment.
async function shadowWriteDiscussionComment(id: string, parentCommentId: string | null, userId: string, authorName: string, commentText: string) {
  try {
    const token = await getWorkerAuthToken();
    if (!token) return;
    await fetch(`${WORKER_URL}/comments`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, articleId: DISCUSSION_ID, parentCommentId, userId, authorName, commentText }),
    });
  } catch {}
}

async function shadowDeleteDiscussionComment(commentId: string) {
  try {
    const token = await getWorkerAuthToken();
    if (!token) return;
    await fetch(`${WORKER_URL}/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token },
    });
  } catch {}
}

async function postDiscussionComment(userId: string, authorName: string, commentText: string, parentCommentId: string | null = null) {
  const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents', {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({
      documentId: 'unique()',
      data: { articleId: DISCUSSION_ID, userId, authorName, commentText, parentCommentId, avatarUrl: '', createdAt: new Date().toISOString() }
    })
  });
  if (!res.ok) throw new Error('Failed to post');
  const doc = await res.json();
  shadowWriteDiscussionComment(doc.$id, parentCommentId, userId, authorName, commentText);
  return doc;
}

async function deleteDiscussionComment(commentId: string) {
  await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents/' + commentId, {
    method: 'DELETE', headers: H, credentials: 'include'
  });
  shadowDeleteDiscussionComment(commentId);
}

async function fetchPinnedCommentId(): Promise<string | null> {
  try {
    const res = await fetch(WORKER_URL + '/contest/settings');
    if (!res.ok) return null;
    const data = await res.json();
    return data.pinnedCommentId || null;
  } catch { return null; }
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
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [pinnedCommentId, setPinnedCommentId] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);

  const isAdmin = !!user && (user.email?.toLowerCase() === ADMIN_EMAIL || (user.labels || []).includes('admin'));

  async function loadDiscussionAndLikes(uidOverride?: string) {
    const uid = uidOverride ?? user?.$id;
    const [comments, pinnedId] = await Promise.all([fetchDiscussion(), fetchPinnedCommentId()]);
    setDiscussion(comments);
    setPinnedCommentId(pinnedId);
    try {
      const likesMap: Record<string, number> = {};
      const userLiked = new Set<string>();
      await Promise.all(comments.map(async (c: any) => {
        const likes = await getCommentLikes(c.$id);
        likesMap[c.$id] = likes.length;
        if (uid && likes.some((l: any) => l.userId === uid)) userLiked.add(c.$id);
      }));
      setCommentLikes(likesMap);
      setLikedComments(userLiked);
    } catch {}
  }

  useEffect(() => {
    async function load() {
      let loadedUser: any = null;
      try {
        const userRes = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        if (userRes.ok) { loadedUser = await userRes.json(); setUser(loadedUser); }
      } catch {}

      try {
        const res = await fetch(WORKER_URL + '/articles?contest=1&limit=100');
        if (res.ok) {
          const data = await res.json();
          const docs = data.documents || [];
          const withVotes = await Promise.all(docs.map(async (a: any) => {
            try {
              const likesRes = await fetch(WORKER_URL + '/likes?articleId=' + encodeURIComponent(a.$id));
              if (likesRes.ok) {
                const likesData = await likesRes.json();
                let commentCount = 0;
              try {
                const commentsRes = await fetch(WORKER_URL + '/comments?articleId=' + encodeURIComponent(a.$id));
                if (commentsRes.ok) {
                  const commentsData = await commentsRes.json();
                  commentCount = commentsData.total || 0;
                }
              } catch {}
              const articleLikes = (likesData.documents || []).filter((l: any) => new Date(l.$createdAt).getTime() < CONTEST_VOTE_CUTOFF_MS).length;
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

      try { await loadDiscussionAndLikes(loadedUser?.$id); } catch {}

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
      await loadDiscussionAndLikes();
    } catch { alert('Could not post. Try again.'); }
    setPosting(false);
  }

  async function handleReply(parentCommentId: string) {
    if (!user) { window.location.href = '/auth'; return; }
    if (!replyText.trim()) return;
    setPostingReply(true);
    try {
      await postDiscussionComment(user.$id, user.name || 'User', replyText.trim(), parentCommentId);
      setReplyText('');
      setReplyingTo(null);
      await loadDiscussionAndLikes();
    } catch { alert('Could not post reply. Try again.'); }
    setPostingReply(false);
  }

  async function handleDeleteDiscussion(commentId: string) {
    if (!confirm('Delete this message?')) return;
    try {
      await deleteDiscussionComment(commentId);
      await loadDiscussionAndLikes();
    } catch {}
  }

  async function handleCommentLike(commentId: string) {
    if (!user) { window.location.href = '/auth'; return; }
    const nowLiked = await toggleCommentLike(commentId, user.$id, DISCUSSION_ID);
    setCommentLikes(prev => ({ ...prev, [commentId]: nowLiked ? (prev[commentId] || 0) + 1 : Math.max(0, (prev[commentId] || 0) - 1) }));
    setLikedComments(prev => { const next = new Set(prev); if (nowLiked) next.add(commentId); else next.delete(commentId); return next; });
  }

  async function handlePinToggle(commentId: string) {
    if (!isAdmin) return;
    setPinning(true);
    try {
      const newPinnedId = pinnedCommentId === commentId ? null : commentId;
      const jwtRes = await fetch(ENDPOINT + '/account/jwt', { method: 'POST', headers: H, credentials: 'include' });
      if (!jwtRes.ok) throw new Error();
      const { jwt } = await jwtRes.json();
      const res = await fetch('/api/admin/contest/pin-comment', {
        method: 'POST',
        headers: { 'x-admin-jwt': jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId: newPinnedId }),
      });
      if (!res.ok) throw new Error();
      setPinnedCommentId(newPinnedId);
    } catch { alert('Could not update pinned message.'); }
    setPinning(false);
  }

  function calcScore(a: any): number {
    return (a.views || 0) * 0.5 + (a._votes || 0) * 1 + (a._comments || 0) * 3;
  }

  const topLevel = discussion.filter(c => !c.parentCommentId);
  const getReplies = (id: string) => discussion.filter(c => c.parentCommentId === id);
  const pinned = pinnedCommentId ? topLevel.find(c => c.$id === pinnedCommentId) : null;
  const rest = topLevel.filter(c => c.$id !== pinnedCommentId);

  function CommentActions({ c, isReply }: { c: any; isReply?: boolean }) {
    const liked = likedComments.has(c.$id);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
        <button onClick={() => handleCommentLike(c.$id)} className="cd-action" style={{ color: liked ? '#c41e3a' : (isDarkMode ? '#888' : '#999'), fontWeight: liked ? 700 : 600 }}>
          {liked ? '❤️' : '🤍'} {commentLikes[c.$id] || 0}
        </button>
        {!isReply && (
          <button onClick={() => { if (!user) { window.location.href = '/auth'; return; } setReplyingTo(replyingTo === c.$id ? null : c.$id); setReplyText(''); }} className="cd-action" style={{ color: isDarkMode ? '#888' : '#999' }}>
            💬 Reply
          </button>
        )}
        {isAdmin && !isReply && (
          <button onClick={() => handlePinToggle(c.$id)} disabled={pinning} className="cd-action" style={{ color: pinnedCommentId === c.$id ? '#f5c518' : (isDarkMode ? '#888' : '#999') }}>
            📌 {pinnedCommentId === c.$id ? 'Unpin' : 'Pin'}
          </button>
        )}
        {user && c.userId === user.$id && (
          <button onClick={() => handleDeleteDiscussion(c.$id)} className="cd-action" style={{ marginLeft: 'auto', color: isDarkMode ? '#666' : '#bbb' }}>Delete</button>
        )}
      </div>
    );
  }

  function CommentCard({ c, pinnedStyle }: { c: any; pinnedStyle?: boolean }) {
    const replies = getReplies(c.$id);
    return (
      <div className="cd-card" style={pinnedStyle ? { border: '2px solid #f5c518', background: isDarkMode ? 'linear-gradient(135deg, #2a2410, #1e1e1e)' : 'linear-gradient(135deg, #fffaf0, #ffffff)' } : {}}>
        {pinnedStyle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#c9971a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            📌 Pinned Message
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="cd-avatar">{getInitials(c.authorName || 'User')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{c.authorName || 'User'}</span>
              <span style={{ fontSize: '11px', color: isDarkMode ? '#777' : '#999' }}>{timeAgo(c.$createdAt)}</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: isDarkMode ? '#ccc' : '#333', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.commentText}</p>
            <CommentActions c={c} />

            {replyingTo === c.$id && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                <input
                  autoFocus
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleReply(c.$id); }}
                  placeholder={'Reply to ' + (c.authorName || 'User') + '...'}
                  style={{ flex: 1, border: '1px solid ' + (isDarkMode ? '#333' : '#e5e5e5'), borderRadius: '18px', padding: '8px 14px', fontSize: '13px', backgroundColor: isDarkMode ? '#121212' : '#fafafa', color: isDarkMode ? '#fff' : '#1a1a1a' }}
                />
                <button onClick={() => handleReply(c.$id)} disabled={postingReply || !replyText.trim()} style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '0 18px', borderRadius: '18px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>
                  {postingReply ? '...' : 'Send'}
                </button>
              </div>
            )}

            {replies.length > 0 && (
              <div className="cd-replies">
                {replies.map((r) => (
                  <div key={r.$id} className="cd-reply">
                    <div className="cd-avatar cd-avatar-sm">{getInitials(r.authorName || 'User')}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{r.authorName || 'User'}</span>
                        <span style={{ fontSize: '10px', color: isDarkMode ? '#777' : '#999' }}>{timeAgo(r.$createdAt)}</span>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: isDarkMode ? '#ccc' : '#333', lineHeight: '1.45', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.commentText}</p>
                      <CommentActions c={r} isReply />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .cd-card { background: ${isDarkMode ? '#1e1e1e' : 'white'}; border-radius: 12px; padding: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.07); transition: box-shadow 0.2s, transform 0.2s; }
        .cd-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
        .cd-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #c41e3a, #a01830); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; box-shadow: 0 2px 6px rgba(196,30,58,0.35); }
        .cd-avatar-sm { width: 28px; height: 28px; font-size: 10px; }
        .cd-action { background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 600; padding: 0; }
        .cd-action:hover { opacity: 0.75; }
        .cd-replies { margin-top: 10px; padding-left: 16px; border-left: 2px solid ${isDarkMode ? '#2a2a2a' : '#f0f0f0'}; display: flex; flex-direction: column; gap: 12px; }
        .cd-reply { display: flex; gap: 8px; }
        .cd-list-row { display: flex; align-items: center; gap: 14px; padding: 14px 18px; text-decoration: none; color: inherit; transition: background-color 0.15s; }
        .cd-list-row:hover { background-color: ${isDarkMode ? '#262626' : '#faf5f6'}; }
        .cd-tab { padding: 11px 20px; border: none; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 800; transition: all 0.2s; }
      `}</style>

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
      <div style={{ width: "100%", background: "linear-gradient(135deg, #c41e3a, #a01830)", padding: "40px 20px", textAlign: "center", color: "white" }}>
        <div style={{ fontSize: "36px", fontWeight: "800", color: "#f5c518" }}>Results Are In!</div>
        <p style={{ margin: "8px 0 20px", fontSize: "16px", opacity: 0.95 }}>Theme: <strong>Life After Election</strong> • ₹10,000 Prize Pool</p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#results" style={{ textDecoration: "none" }}>
            <button style={{ backgroundColor: "#f5c518", color: "#1a1a1a", border: "none", padding: "12px 28px", borderRadius: "30px", fontWeight: "800", fontSize: "15px", cursor: "pointer" }}>🏆 View Final Results</button>
          </a>
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
        <div id="results" style={{ display: 'flex', gap: '10px', marginBottom: '20px', scrollMarginTop: '70px' }}>
          {([
            ['list', '📋 Results List'],
            ['discussion', '💬 Discussion' + (discussion.length ? ' (' + discussion.length + ')' : '')],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key as 'list' | 'discussion')} className="cd-tab" style={{
              backgroundColor: activeTab === key ? '#c41e3a' : (isDarkMode ? '#1e1e1e' : 'white'),
              color: activeTab === key ? 'white' : (isDarkMode ? '#aaa' : '#666'),
              boxShadow: activeTab === key ? '0 4px 12px rgba(196,30,58,0.35)' : '0 1px 4px rgba(0,0,0,0.06)',
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
                  <Link key={a.$id} href={'/article/' + a.$id} className="cd-list-row" style={{ borderBottom: i < entries.length - 1 ? '1px solid ' + (isDarkMode ? '#2a2a2a' : '#f0f0f0') : 'none' }}>
                    <div style={{ width: '30px', flexShrink: 0, textAlign: 'center', fontSize: medal ? '20px' : '14px', fontWeight: '800', color: medal ? undefined : (isDarkMode ? '#666' : '#aaa') }}>
                      {medal || (i + 1)}
                    </div>
                    <div className="cd-avatar">{getInitials(author)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                      <div style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#999' }}>{author}</div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#f5c518', flexShrink: 0 }}>⭐ {Math.round(calcScore(a)).toLocaleString()}</div>
                  </Link>
                );
              })}
            </div>
          )
        )}

        {/* DISCUSSION */}
        {activeTab === 'discussion' && (
          <div style={{ marginBottom: '40px' }}>
            <div className="cd-card" style={{ marginBottom: '16px' }}>
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

            {pinned && <div style={{ marginBottom: '10px' }}><CommentCard c={pinned} pinnedStyle /></div>}

            {rest.length === 0 && !pinned ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <p style={{ fontSize: '14px', color: isDarkMode ? '#888' : '#999', margin: 0 }}>No comments yet — start the conversation!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rest.map((c) => <CommentCard key={c.$id} c={c} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
