'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toggleCommentLike, getCommentLikes, getArticleLikes, toggleArticleLike, getWorkerAuthToken } from '@/lib/appwrite';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

// Week 15+28+43 of the Cloudflare migration (see cloudflare/README.md):
// these comments reuse the shared `comments` table (articleId = the
// Hills in Frame photo id), same as article/contest/Bhasa Diwas
// comments -- reads come from the Worker, and posts write to D1
// directly now (Week 28 cutover). No delete UI exists for these
// comments, so there was never a delete call site to cut over. Week 43:
// the photo's own image URL moved off Appwrite Storage too.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

const COMMENT_COLORS = [
  { bg: '#fef2f2', border: '#fecaca', avatar: '#dc2626' },
  { bg: '#eff6ff', border: '#bfdbfe', avatar: '#2563eb' },
  { bg: '#f0fdf4', border: '#bbf7d0', avatar: '#16a34a' },
  { bg: '#fefce8', border: '#fef08a', avatar: '#ca8a04' },
  { bg: '#faf5ff', border: '#e9d5ff', avatar: '#9333ea' },
  { bg: '#fff7ed', border: '#fed7aa', avatar: '#ea580c' },
];
function getImageUrl(fileId: string): string {
  return WORKER_URL + '/cdn/articles/' + fileId;
}

interface Photo {
  $id: string;
  title: string;
  caption: string;
  location: string | null;
  imageFileId: string;
  submitterName: string;
}

export default function HillsInFrameSwipeClient({ photos, startIndex }: { photos: Photo[]; startIndex: number }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const lastTapTime = useRef(0);

  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showHeartPop, setShowHeartPop] = useState(false);

  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const photo = photos[index];

  useEffect(() => {
    if (!photo) return;
    loadLikes();
    loadComments();
  }, [photo?.$id, user?.$id]);

  async function loadLikes() {
    try {
      const docs = await getArticleLikes(photo.$id);
      setLikeCount(docs.length);
      if (user) setLiked(docs.some((d: any) => d.userId === user.$id));
      else setLiked(false);
    } catch {}
  }

  async function loadComments() {
    try {
      const res = await fetch(WORKER_URL + '/comments?articleId=' + encodeURIComponent(photo.$id));
      if (res.ok) {
        const data = await res.json();
        setComments(data.documents || []);
        const likeCounts: Record<string, number> = {};
        const likedSet = new Set<string>();
        for (const c of (data.documents || [])) {
          const cLikes = await getCommentLikes(c.$id);
          likeCounts[c.$id] = cLikes.length;
          if (user && cLikes.some((l: any) => l.userId === user.$id)) likedSet.add(c.$id);
        }
        setCommentLikes(likeCounts);
        setLikedComments(likedSet);
      }
    } catch {}
  }

  // Week 28: this had its own separate, never-migrated likes
  // implementation -- still hitting Appwrite directly for both read and
  // write, missed entirely by Week 25's likes cutover (which only
  // touched the shared toggleArticleLike helper, not this file's own
  // copy). Switched to that shared helper, now D1-only.
  async function handleLikeToggle() {
    if (!isAuthenticated || !user) {
      router.push('/auth');
      return;
    }
    const prevLiked = liked;
    setLiked(!prevLiked);
    setLikeCount((c) => prevLiked ? Math.max(0, c - 1) : c + 1);
    try {
      await toggleArticleLike(photo.$id, user.$id);
    } catch {
      setLiked(prevLiked);
      setLikeCount((c) => prevLiked ? c + 1 : Math.max(0, c - 1));
    }
  }

  function handleDoubleTapLike() {
    if (!liked) handleLikeToggle();
    setShowHeartPop(true);
    setTimeout(() => setShowHeartPop(false), 700);
  }

  async function handlePostComment() {
    if (!isAuthenticated || !user) {
      router.push('/auth');
      return;
    }
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      const token = await getWorkerAuthToken();
      if (token) {
        await fetch(`${WORKER_URL}/comments`, {
          method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: crypto.randomUUID(), articleId: photo.$id, parentCommentId: null, userId: user.$id, authorName: user.name || 'User', commentText: commentText.trim() }),
        });
      }
      setCommentText('');
      loadComments();
    } catch {}
    setPostingComment(false);
  }
  async function handleReply(parentCommentId: string) {
    if (!isAuthenticated || !user) {
      router.push('/auth');
      return;
    }
    if (!replyText.trim()) return;
    setPostingReply(true);
    try {
      const token = await getWorkerAuthToken();
      if (token) {
        await fetch(`${WORKER_URL}/comments`, {
          method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: crypto.randomUUID(), articleId: photo.$id, parentCommentId, userId: user.$id, authorName: user.name || 'User', commentText: replyText.trim() }),
        });
      }
      setReplyText('');
      setReplyingTo(null);
      loadComments();
    } catch {}
    setPostingReply(false);
  }
  async function handleCommentLikeClick(commentId: string) {
    if (!isAuthenticated || !user) {
      router.push('/auth');
      return;
    }
    const nowLiked = await toggleCommentLike(commentId, user.$id, photo.$id);
    setCommentLikes((prev) => ({ ...prev, [commentId]: nowLiked ? (prev[commentId] || 0) + 1 : Math.max(0, (prev[commentId] || 0) - 1) }));
    setLikedComments((prev) => {
      const next = new Set(prev);
      if (nowLiked) next.add(commentId); else next.delete(commentId);
      return next;
    });
  }

  function goTo(newIndex: number) {
    const wrapped = ((newIndex % photos.length) + photos.length) % photos.length;
    setIndex(wrapped);
    router.replace('/hills-in-frame/' + photos[wrapped].$id, { scroll: false });
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }

  function handleTouchEnd() {
    if (Math.abs(touchDeltaX.current) > 60) {
      if (touchDeltaX.current > 0) goTo(index - 1);
      else goTo(index + 1);
    } else {
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        handleDoubleTapLike();
      }
      lastTapTime.current = now;
    }
    touchDeltaX.current = 0;
  }

  if (!photo) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#c41e3a', color: 'white', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ color: 'white', textDecoration: 'none', fontSize: '18px', fontWeight: 800 }}>Khabar Darjeeling</Link>
        <Link href="/hills-in-frame" style={{ background: 'white', color: '#c41e3a', padding: '8px 18px', borderRadius: '20px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>Back to Gallery</Link>
      </div>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '30px 20px' }}>
        <div style={{ position: 'relative' }}>
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleTapLike}
            style={{ position: 'relative', borderRadius: '6px', overflow: 'hidden', background: '#e5e7eb', marginBottom: '20px', boxShadow: '0 12px 36px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', touchAction: 'pan-y' }}
          >
            {photo.imageFileId && (
              <img src={getImageUrl(photo.imageFileId)} alt={photo.title} style={{ width: '100%', display: 'block' }} draggable={false} />
            )}
            {showHeartPop && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '90px', animation: 'heartPop 0.7s ease', pointerEvents: 'none' as const }}>
                &#10084;&#65039;
              </div>
            )}
          </div>
          <style>{'@keyframes heartPop { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 30% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); } 60% { transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1); } }'}</style>

          <button
            onClick={() => goTo(index - 1)}
            aria-label="Previous photo"
            style={{ position: 'absolute', top: '50%', left: '8px', transform: 'translateY(-50%)', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >&lsaquo;</button>
          <button
            onClick={() => goTo(index + 1)}
            aria-label="Next photo"
            style={{ position: 'absolute', top: '50%', right: '8px', transform: 'translateY(-50%)', width: '38px', height: '38px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >&rsaquo;</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <button onClick={handleLikeToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '26px', padding: 0, lineHeight: 1 }}>
            {liked ? '\u2764\uFE0F' : '🤍'}
          </button>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 10px', fontFamily: 'Georgia, serif' }}>{photo.title}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' as const }}>
          {photo.location && (
            <span style={{ fontSize: '13px', color: '#6b7280' }}>&#128205; {photo.location}</span>
          )}
          <span style={{ fontSize: '13px', color: '#6b7280' }}>By {photo.submitterName}</span>
          <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto' }}>{index + 1} / {photos.length}</span>
        </div>

        {photo.caption && (
          <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: '18px', marginBottom: '24px' }}>{photo.caption}</p>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#1a1a1a', marginBottom: '14px' }}>Comments</h2>

          {isAuthenticated ? (
            <div style={{ marginBottom: '20px' }}>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minHeight: '70px', boxSizing: 'border-box' as const, fontFamily: 'inherit', marginBottom: '8px' }}
              />
              <button onClick={handlePostComment} disabled={postingComment} style={{ background: '#c41e3a', color: 'white', padding: '8px 20px', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                {postingComment ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          ) : (
            <p style={{ color: '#6b7280', fontSize: '13px', marginBottom: '20px' }}>
              <Link href="/auth" style={{ color: '#c41e3a', fontWeight: 700 }}>Log in</Link> to comment.
            </p>
          )}

          {(() => {
            const topLevel = comments.filter((c: any) => !c.parentCommentId);
            const getReplies = (parentId: string) => comments.filter((c: any) => c.parentCommentId === parentId);
            if (topLevel.length === 0) return <p style={{ color: '#9ca3af', fontSize: '13px' }}>No comments yet.</p>;
            return topLevel.map((c: any, ci: number) => {
              const cc = COMMENT_COLORS[ci % COMMENT_COLORS.length];
              const replies = getReplies(c.$id);
              const isLiked = likedComments.has(c.$id);
              return (
                <div key={c.$id} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px', padding: '12px 14px', background: cc.bg, borderRadius: '10px', border: '1px solid ' + cc.border }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: cc.avatar, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>{(c.authorName || 'U').charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a' }}>{c.authorName}</div>
                      <div style={{ fontSize: '13px', color: '#374151', marginTop: '3px', lineHeight: 1.5 }}>{c.commentText}</div>
                      <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                        <button onClick={() => handleCommentLikeClick(c.$id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: isLiked ? '#c41e3a' : '#6b7280', padding: 0 }}>
                          {isLiked ? '\u2764\uFE0F' : '\u{1F90D}'} {commentLikes[c.$id] || 0}
                        </button>
                        <button onClick={() => setReplyingTo(replyingTo === c.$id ? null : c.$id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#6b7280', padding: 0 }}>Reply</button>
                      </div>
                    </div>
                  </div>
                  {replyingTo === c.$id && (
                    <div style={{ marginLeft: '30px', marginTop: '8px' }}>
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder='Write a reply...' style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', minHeight: '50px', boxSizing: 'border-box' as const, fontFamily: 'inherit', marginBottom: '6px' }} />
                      <button onClick={() => handleReply(c.$id)} disabled={postingReply} style={{ background: '#c41e3a', color: 'white', padding: '6px 16px', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
                        {postingReply ? 'Posting...' : 'Post Reply'}
                      </button>
                    </div>
                  )}
                  {replies.length > 0 && (
                    <div style={{ marginLeft: '30px', marginTop: '8px', display: 'flex', flexDirection: 'column' as const, gap: '8px' }}>
                      {replies.map((r: any) => (
                        <div key={r.$id} style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #eee' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#9ca3af', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{(r.authorName || 'U').charAt(0).toUpperCase()}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '12px', color: '#1a1a1a' }}>{r.authorName}</div>
                            <div style={{ fontSize: '12px', color: '#374151', marginTop: '2px', lineHeight: 1.5 }}>{r.commentText}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#c0c0c0', marginTop: '30px' }}>Swipe or use arrows to browse - double-tap to like</p>
      </div>
    </div>
  );
}
