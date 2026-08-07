'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const BUCKET = 'article-image';
const H = { 'X-Appwrite-Project': PROJECT };
const HJ = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };

const COMMENT_COLORS = [
  { bg: '#fef2f2', border: '#fecaca', avatar: '#dc2626' },
  { bg: '#eff6ff', border: '#bfdbfe', avatar: '#2563eb' },
  { bg: '#f0fdf4', border: '#bbf7d0', avatar: '#16a34a' },
  { bg: '#fefce8', border: '#fef08a', avatar: '#ca8a04' },
  { bg: '#faf5ff', border: '#e9d5ff', avatar: '#9333ea' },
  { bg: '#fff7ed', border: '#fed7aa', avatar: '#ea580c' },
];
function getImageUrl(fileId: string): string {
  return 'https://nyc.cloud.appwrite.io/v1/storage/buckets/' + BUCKET + '/files/' + fileId + '/view?project=' + PROJECT;
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

  const photo = photos[index];

  useEffect(() => {
    if (!photo) return;
    loadLikes();
    loadComments();
  }, [photo?.$id, user?.$id]);

  async function loadLikes() {
    try {
      const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [photo.$id] }));
      const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' + q1, { headers: H });
      if (res.ok) {
        const data = await res.json();
        setLikeCount(data.total || 0);
        if (user) setLiked((data.documents || []).some((d: any) => d.userId === user.$id));
        else setLiked(false);
      }
    } catch {}
  }

  async function loadComments() {
    try {
      const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [photo.$id] }));
      const q2 = encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }));
      const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents?queries[]=' + q1 + '&queries[]=' + q2, { headers: H });
      if (res.ok) {
        const data = await res.json();
        setComments(data.documents || []);
      }
    } catch {}
  }

  async function handleLikeToggle() {
    if (!isAuthenticated || !user) {
      router.push('/auth');
      return;
    }
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      try {
        const q1 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [photo.$id] }));
        const q2 = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [user.$id] }));
        const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' + q1 + '&queries[]=' + q2, { headers: H, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.documents?.[0]) {
            await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents/' + data.documents[0].$id, { method: 'DELETE', headers: H, credentials: 'include' });
          }
        }
      } catch {}
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      try {
        await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents', {
          method: 'POST', headers: HJ, credentials: 'include',
          body: JSON.stringify({ documentId: 'unique()', data: { articleId: photo.$id, userId: user.$id, commentId: null } })
        });
      } catch {}
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
      await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents', {
        method: 'POST', headers: HJ, credentials: 'include',
        body: JSON.stringify({
          documentId: 'unique()',
          data: { articleId: photo.$id, userId: user.$id, authorName: user.name || 'User', commentText: commentText.trim(), parentCommentId: null, avatarUrl: '', createdAt: new Date().toISOString() }
        })
      });
      setCommentText('');
      loadComments();
    } catch {}
    setPostingComment(false);
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

          {comments.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>No comments yet.</p>
          ) : (
            comments.map((c: any, ci: number) => {
              const cc = COMMENT_COLORS[ci % COMMENT_COLORS.length];
              return (
                <div key={c.$id} style={{ display: 'flex', gap: '10px', padding: '12px 14px', marginBottom: '10px', background: cc.bg, borderRadius: '10px', border: '1px solid ' + cc.border }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: cc.avatar, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>{(c.authorName || 'U').charAt(0).toUpperCase()}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1a1a1a' }}>{c.authorName}</div>
                    <div style={{ fontSize: '13px', color: '#374151', marginTop: '3px', lineHeight: 1.5 }}>{c.commentText}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#c0c0c0', marginTop: '30px' }}>Swipe or use arrows to browse - double-tap to like</p>
      </div>
    </div>
  );
}
