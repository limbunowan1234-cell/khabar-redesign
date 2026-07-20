'use client';
import AuthorBadge from '@/components/AuthorBadge';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getArticle, getArticleLikes, toggleArticleLike, getUserBookmarks, toggleBookmark, getCommentLikes, toggleCommentLike, incrementViews } from '@/lib/appwrite';
import { useAuthStore } from '@/lib/authStore';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': PROJECT };
const HJ = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };
const DB = 'Khabar_db';

function getImageUrl(article: any): string {
  const id = article.imageFileId;
  if (!id || ['Text','null','undefined',''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return ENDPOINT + '/storage/buckets/article-image/files/' + id + '/view?project=' + PROJECT;
}

function getInitials(name: string): string {
  if (!name) return 'KD';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

function fmtDate(s: string): string {
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return ''; }
}

function extractTags(title: string, category: string, location: string): string[] {
  if (!title) return [];
  const words = title.split(/\s+/);
  const stopwords = new Set(['The', 'A', 'An', 'In', 'On', 'At', 'For', 'And', 'Or', 'But', 'Is', 'Are', 'Was', 'Were', 'To', 'Of', 'With', 'By', 'From', 'After', 'Before', 'How', 'Why', 'What', 'When', 'Life']);
  const phrases: string[] = [];
  let current: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[^a-zA-Z0-9']/g, '');
    if (clean.length > 0 && clean[0] === clean[0].toUpperCase() && /[a-zA-Z]/.test(clean[0]) && !stopwords.has(clean)) {
      current.push(clean);
    } else {
      if (current.length > 0) phrases.push(current.join(' '));
      current = [];
    }
  }
  if (current.length > 0) phrases.push(current.join(' '));

  const existing = new Set([category, location].filter(Boolean).map(s => s.toLowerCase()));
  const unique = phrases.filter(p => p.length > 2 && !existing.has(p.toLowerCase()));
  const deduped = Array.from(new Set(unique));
  return deduped.slice(0, 3);
}

function renderContent(content: string, isDarkMode: boolean) {
  if (!content) return null;
  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0);
  let firstParaDone = false;
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>+\s*/, '');
      return (
        <blockquote key={i} style={{ margin: '28px 0', padding: '4px 0 4px 20px', borderLeft: '4px solid #c41e3a', fontStyle: 'italic', fontSize: '21px', lineHeight: '1.6', color: isDarkMode ? '#f0c0c0' : '#7a1020', fontFamily: 'Georgia, serif' }}>
          {quoteText}
        </blockquote>
      );
    }
    if (!firstParaDone) {
      firstParaDone = true;
      const firstChar = trimmed.charAt(0);
      const rest = trimmed.slice(1);
      return (
        <p key={i} style={{ margin: '0 0 20px' }}>
          <span style={{ float: 'left', fontSize: '64px', lineHeight: '52px', fontWeight: '800', paddingRight: '8px', paddingTop: '4px', color: '#c41e3a', fontFamily: 'Georgia, serif' }}>{firstChar}</span>
          {rest}
        </p>
      );
    }
    return <p key={i} style={{ margin: '0 0 20px' }}>{trimmed}</p>;
  });
}

function readingTime(content: string): string {
  const words = (content || '').split(' ').length;
  return Math.max(1, Math.ceil(words / 200)) + ' min read';
}

async function fetchComments(articleId: string) {
  const res = await fetch(
    ENDPOINT + '/databases/' + DB + '/collections/comments/documents?queries[]=' +
    encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [articleId] })) +
    '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })) +
    '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
    { headers: H, credentials: 'include' }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.documents || [];
}

async function createComment(articleId: string, userId: string, authorName: string, commentText: string, parentCommentId: string | null) {
  const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents', {
    method: 'POST', headers: HJ, credentials: 'include',
    body: JSON.stringify({
      documentId: 'unique()',
      data: { articleId, userId, authorName, commentText, parentCommentId: parentCommentId || null, avatarUrl: '', createdAt: new Date().toISOString() }
    })
  });
  if (!res.ok) throw new Error('Failed to post comment');
  return res.json();
}

async function deleteComment(commentId: string) {
  const res = await fetch(ENDPOINT + '/databases/' + DB + '/collections/comments/documents/' + commentId, {
    method: 'DELETE', headers: H, credentials: 'include'
  });
  return res.ok;
}

async function notifyUser(targetUserId: string, fromUserId: string, type: string, message: string, articleId: string, articleSlug: string, fromUserName: string) {
  if (!targetUserId || targetUserId === fromUserId) return; // do not notify yourself
  try {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUserId, type, message, articleId, articleSlug, fromUserName, title: 'Khabar Darjeeling' })
    });
  } catch (err) {
    console.error('Notify failed:', err);
  }
}

export default function ArticleClient({ initialArticle }: { initialArticle?: any }) {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuthStore();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [article, setArticle] = useState<any>(initialArticle || null);
  const [loading, setLoading] = useState(!initialArticle);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeProcessing, setLikeProcessing] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [shareMsg, setShareMsg] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentLikes, setCommentLikes] = useState<Record<string, number>>({});
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState('');
  const [readProgress, setReadProgress] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [postingReply, setPostingReply] = useState(false);

  const isAdmin = (user as any)?.labels?.includes("admin") || user?.email === "nowanad@gmail.com";

  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  async function checkFollowing(authorId: string) {
    if (!user || !authorId || authorId === user.$id) return;
    try {
      const res = await fetch(
        ENDPOINT + "/databases/" + DB + "/collections/follows/documents?queries[]=" +
        encodeURIComponent(JSON.stringify({ method: "equal", attribute: "followerId", values: [user.$id] })) +
        "&queries[]=" + encodeURIComponent(JSON.stringify({ method: "equal", attribute: "followingId", values: [authorId] })),
        { headers: H, credentials: "include" }
      );
      if (res.ok) { const d = await res.json(); setFollowing((d.documents || []).length > 0); }
    } catch {}
  }

  async function handleFollow(authorId: string, authorName: string) {
    if (!user) { window.location.href = "/auth"; return; }
    setFollowLoading(true);
    try {
      if (following) {
        const res = await fetch(
          ENDPOINT + "/databases/" + DB + "/collections/follows/documents?queries[]=" +
          encodeURIComponent(JSON.stringify({ method: "equal", attribute: "followerId", values: [user.$id] })) +
          "&queries[]=" + encodeURIComponent(JSON.stringify({ method: "equal", attribute: "followingId", values: [authorId] })),
          { headers: H, credentials: "include" }
        );
        if (res.ok) {
          const d = await res.json();
          if (d.documents?.[0]) {
            await fetch(ENDPOINT + "/databases/" + DB + "/collections/follows/documents/" + d.documents[0].$id, { method: "DELETE", headers: H, credentials: "include" });
          }
        }
        setFollowing(false);
      } else {
        await fetch(ENDPOINT + "/databases/" + DB + "/collections/follows/documents", {
          method: "POST", headers: HJ, credentials: "include",
          body: JSON.stringify({ documentId: "unique()", data: { followerId: user.$id, followerName: user.name, followingId: authorId, followingName: authorName, createdAt: new Date().toISOString() } })
        });
        setFollowing(true);
      }
    } catch {}
    setFollowLoading(false);
  }

  useEffect(() => {
    if (!id) return;
    async function load() {
      incrementViews(id);
        const data = await getArticle(id);
      if (data) setArticle(data);
      setLoading(false);
      const cms = await fetchComments(id);
      setComments(cms);
      const likes = await getArticleLikes(id);
      setLikeCount(likes.length);
      if (user) {
        setLiked(likes.some((l: any) => l.userId === user.$id));
        const bks = await getUserBookmarks(user.$id);
        setBookmarked(bks.some((b: any) => b.articleId === id));
        if (data?.submitterId) checkFollowing(data.submitterId);
          const likesMap: Record<string, number> = {};
          const userLiked = new Set<string>();
          for (const c of cms) {
            const clikes = await getCommentLikes(c.$id);
            likesMap[c.$id] = clikes.length;
            if (clikes.some((l: any) => l.userId === user.$id)) {
              userLiked.add(c.$id);
            }
          }
          setCommentLikes(likesMap);
          setLikedComments(userLiked);
      }
    }
    load();
  }, [id, user]);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
      setReadProgress(pct);
    }
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  async function handleLike() {
    if (!user) { window.location.href = '/auth'; return; }
    if (likeProcessing) return;
    setLikeProcessing(true);
    const nowLiked = await toggleArticleLike(id, user.$id);
    if (nowLiked) notifyUser(article.submitterId, user.$id, 'like', (user.name || 'Someone') + ' liked your article', id, article.slug || id, user.name || 'User');
    setLiked(nowLiked);
    setLikeCount((c) => nowLiked ? c + 1 : Math.max(0, c - 1));
    setLikeProcessing(false);
  }

  async function handleBookmark() {
    if (!user) { window.location.href = '/auth'; return; }
    const nowBookmarked = await toggleBookmark(id, user.$id);
    setBookmarked(nowBookmarked);
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: article.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setShareMsg('Link copied!');
        setTimeout(() => setShareMsg(''), 2000);
      });
    }
  }

  async function handlePost() {
    if (!user) { window.location.href = '/auth'; return; }
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      await createComment(id, user.$id, user.name || 'User', newComment.trim(), null);
      notifyUser(article.submitterId, user.$id, 'comment', (user.name || 'Someone') + ' commented on your article', id, article.slug || id, user.name || 'User');
      setNewComment('');
      const cms = await fetchComments(id);
      setComments(cms);
    } catch { alert('Could not post comment'); }
    setPosting(false);
  }

  async function handleReply(parentCommentId: string) {
    if (!user) { window.location.href = '/auth'; return; }
    if (!replyText.trim()) return;
    setPostingReply(true);
    try {
      await createComment(id, user.$id, user.name || 'User', replyText.trim(), parentCommentId);
      notifyUser(article.submitterId, user.$id, 'reply', (user.name || 'Someone') + ' replied to a comment on your article', id, article.slug || id, user.name || 'User');
      setReplyText('');
      setReplyingTo(null);
      const cms = await fetchComments(id);
      setComments(cms);
    } catch { alert('Could not post reply'); }
    setPostingReply(false);
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment(commentId);
      const cms = await fetchComments(id);
      setComments(cms);
    } catch { alert('Could not delete comment'); }
  }

  async function handleCommentLike(commentId: string) {
    if (!user) { window.location.href = "/auth"; return; }
    const nowLiked = await toggleCommentLike(commentId, user.$id, id);
    setCommentLikes(prev => ({ ...prev, [commentId]: nowLiked ? (prev[commentId] || 0) + 1 : Math.max(0, (prev[commentId] || 0) - 1) }));
    setLikedComments(prev => new Set(nowLiked ? [...prev, commentId] : [...prev].filter(id => id !== commentId)));
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #c41e3a, #a01830)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <img src="/assets/logo.png" alt="logo" style={{ width: '70px', height: '70px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', marginBottom: '20px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '16px', fontSize: '14px' }}>Loading article...</p>
    </div>
  );

  if (!article && !initialArticle) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>

      <div style={{ fontSize: '48px' }}>{String.fromCodePoint(0x1F4F0)}</div>
      <p style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>Article not found</p>
      <Link href="/"><button style={{ backgroundColor: '#c41e3a', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Back to Home</button></Link>
    </div>
  );

  const imgUrl = getImageUrl(article);
  const author = article.submitterName || article.authorName || 'Staff Reporter';
  const avatar = article.submitterAvatar;
  const topLevelComments = comments.filter(c => !c.parentCommentId);
  const getReplies = (commentId: string) => comments.filter(c => c.parentCommentId === commentId);

  const btnStyle = (active: boolean, color: string) => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    backgroundColor: active ? color : '#f5f5f5',
    color: active ? 'white' : '#333',
    border: 'none', padding: '8px 16px', borderRadius: '20px',
    cursor: 'pointer', fontWeight: '600' as any, fontSize: '13px',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, height: '3px', width: readProgress + '%', backgroundColor: '#f5c518', zIndex: 999, transition: 'width 0.1s ease-out' }} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .act-btn:hover { opacity: 0.85; transform: scale(1.03); }
        .act-btn { transition: all 0.2s; }
        .reply-btn { background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 4px; transition: background 0.2s; }
        .del-btn { background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 700; color: #c41e3a; padding: 3px 8px; border-radius: 4px; transition: background 0.2s; }
        .del-btn:hover { background: rgba(196,30,58,0.1); }
        .reply-btn:hover { background: rgba(0,0,0,0.06); }
      `}</style>

      {/* HEADER */}
      <header style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#c41e3a', color: 'white', padding: '12px 20px', borderBottom: '3px solid #f5c518', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/assets/logo.png" alt="logo" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span style={{ fontWeight: '800', fontSize: '16px' }}>खबर दार्जिलिङ</span>
          </Link>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <button style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>Home</button>
            </Link>
            <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '15px' }}>
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* HERO IMAGE */}
      {imgUrl && (
        <div style={{ position: 'relative', width: '100%', height: '500px', overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
          <Image src={imgUrl} alt={article.title} fill sizes='100vw' priority style={{ objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.7) 100%)' }} />
          {article.category && <div style={{ position: 'absolute', top: '16px', left: '16px', backgroundColor: '#c41e3a', color: 'white', padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' }}>{article.category}</div>}
          {article.isBreaking && <div style={{ position: 'absolute', top: '16px', right: '16px', backgroundColor: '#f5c518', color: '#1a1a1a', padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>🔴 BREAKING</div>}
        </div>
      )}

      {/* NO IMAGE HERO */}
      {!imgUrl && (
        <div style={{ background: 'linear-gradient(135deg, #c41e3a 0%, #a01830 100%)', padding: '40px 20px 30px', color: 'white' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {article.category && <span style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '5px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '16px' }}>{article.category}</span>}
            <h1 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: '800', lineHeight: '1.2', margin: 0, color: 'white' }}>{article.title}</h1>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 16px', animation: 'fadeIn 0.4s ease' }}>

        {/* TITLE BELOW HERO */}
        {imgUrl && (
          <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', padding: '24px 28px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <h1 style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: '800', lineHeight: '1.3', color: isDarkMode ? '#fff' : '#1a1a1a', margin: 0 }}>{article.title}</h1>
          </div>
        )}

        {/* META */}
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', padding: '16px 28px', borderTop: '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0'), marginTop: imgUrl ? '0' : '16px', borderRadius: imgUrl ? '0' : '12px 12px 0 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {(avatar && avatar !== 'null') ? (
                <img src={avatar} alt={author} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f5c518' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '700', border: '2px solid #f5c518', flexShrink: 0 }}>{getInitials(author)}</div>
              )}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <Link href={"/profile/" + article.submitterId} style={{ textDecoration: "none", color: "inherit" }}><div style={{ fontWeight: "700", fontSize: "15px", color: isDarkMode ? "#fff" : "#1a1a1a", cursor: "pointer" }}>{author}</div></Link>
                  {article.submitterId && <AuthorBadge submitterId={article.submitterId} size="sm" />}
                  {user && article.submitterId && article.submitterId !== user.$id && (
                    <button onClick={() => handleFollow(article.submitterId, author)} disabled={followLoading} style={{ backgroundColor: following ? "transparent" : "#c41e3a", color: following ? "#c41e3a" : "white", border: "1px solid #c41e3a", padding: "4px 12px", borderRadius: "16px", cursor: "pointer", fontWeight: "700", fontSize: "12px" }}>
                      {followLoading ? "..." : following ? "Following" : "+ Follow"}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#888', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {article.publishedAt && <span>{fmtDate(article.publishedAt)}</span>}
                  {article.location && <span>{article.location}</span>}
                  <span>{readingTime(article.content)}</span>
                  {article.views > 0 && <span>👁 {article.views.toLocaleString()}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="act-btn" onClick={handleLike} style={btnStyle(liked, '#c41e3a')}>{liked ? '❤️' : '🤍'} {likeCount > 0 ? likeCount : ''} Like</button>
              <button className="act-btn" onClick={handleBookmark} style={btnStyle(bookmarked, '#f5c518')} >{bookmarked ? '🔖 Saved' : '🔖 Save'}</button>
              <button className="act-btn" onClick={handleShare} style={btnStyle(false, '#333')}>🔗 {shareMsg || 'Share'}</button>
            </div>
          </div>
        </div>

        {/* YOUTUBE */}
        {article.youtube_id && (
          <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', padding: '0 28px 24px' }}>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: '12px', overflow: 'hidden' }}>
              <iframe src={'https://www.youtube.com/embed/' + article.youtube_id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={article.title} />
            </div>
          </div>
        )}

        {article.trackerData && (() => {
          let tracker: any = null;
          try { tracker = JSON.parse(article.trackerData); } catch {}
          if (!tracker || !tracker.items || tracker.items.length === 0) return null;
          return (
            <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', padding: '20px 28px', borderTop: '3px solid #c41e3a', margin: '0 0 2px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px' }}>Live: {tracker.title}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tracker.items.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < tracker.items.length - 1 ? '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0') : 'none' }}>
                    <span style={{ fontSize: '14px', color: isDarkMode ? '#ddd' : '#333' }}>{item.label}</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* CONTENT */}
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', padding: '28px', borderTop: '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0'), borderBottom: '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0') }}>
          <div style={{ fontSize: '17px', lineHeight: '1.9', color: isDarkMode ? '#ddd' : '#2a2a2a', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
            {article.category === 'Photo Story' ? '' : renderContent(article.content || article.summary, isDarkMode)}
          </div>


          <div style={{ backgroundColor: isDarkMode ? '#2a1518' : '#fff8e1', border: '1px solid ' + (isDarkMode ? '#4a2530' : '#f5c518'), borderRadius: '10px', padding: '18px 20px', margin: '0 28px 20px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#f5c518' : '#7a5c00' }}>Have a tip on this story?</p>
            <p style={{ margin: 0, fontSize: '13px', color: isDarkMode ? '#ddd' : '#5a4a00', lineHeight: '1.6' }}>
              WhatsApp Khabar Darjeeling at <a href='https://whatsapp.com/channel/0029VbD933y3LdQQ0g9Z682b' target='_blank' rel='noopener noreferrer' style={{ color: '#c41e3a', fontWeight: '700', textDecoration: 'none' }}>our channel</a> or email <a href='mailto:nowanad@gmail.com' style={{ color: '#c41e3a', fontWeight: '700', textDecoration: 'none' }}>nowanad@gmail.com</a>. Your identity will be protected.
            </p>
          </div>
          {article.galleryImageIds && article.galleryImageIds.length > 0 && (
            <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', padding: '20px 28px 28px', borderBottom: '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0') }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', marginBottom: '14px' }}>Photo Gallery ({article.galleryImageIds.length + 1})</h3>
              <div
                style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#000', aspectRatio: '16/10', maxHeight: '480px' }}
                onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                onTouchEnd={(e) => {
                  const diff = touchStartX - e.changedTouches[0].clientX;
                  if (diff > 50) setGalleryIndex((i) => Math.min(i + 1, article.galleryImageIds.length - 1));
                  if (diff < -50) setGalleryIndex((i) => Math.max(i - 1, 0));
                }}
              >
                <img src={getImageUrl({ imageFileId: article.galleryImageIds[galleryIndex] })} alt={'Gallery photo ' + (galleryIndex + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', backgroundColor: '#000' }} />
                {galleryIndex > 0 && (
                  <button onClick={() => setGalleryIndex((i) => Math.max(i - 1, 0))} style={{ position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)', width: '38px', height: '38px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&lsaquo;</button>
                )}
                {galleryIndex < article.galleryImageIds.length - 1 && (
                  <button onClick={() => setGalleryIndex((i) => Math.min(i + 1, article.galleryImageIds.length - 1))} style={{ position: 'absolute', top: '50%', right: '10px', transform: 'translateY(-50%)', width: '38px', height: '38px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&rsaquo;</button>
                )}
                <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                  {galleryIndex + 1} / {article.galleryImageIds.length}
                </div>
                <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
                  {article.galleryImageIds.map((_: string, i: number) => (
                    <div key={i} onClick={() => setGalleryIndex(i)} style={{ width: '6px', height: '6px', borderRadius: '50%', cursor: 'pointer', backgroundColor: i === galleryIndex ? '#fff' : 'rgba(255,255,255,0.4)' }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {article.category && (
            <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0'), display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: isDarkMode ? '#aaa' : '#888' }}>Tags:</span>
              {[...[article.category, article.location].filter(Boolean), ...extractTags(article.title, article.category, article.location)].map((tag, i) => (
                <span key={i} style={{ backgroundColor: isDarkMode ? '#2a2a2a' : '#f5f5f5', color: '#c41e3a', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', border: '1px solid #c41e3a22' }}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM ACTIONS */}
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', padding: '16px 28px', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginBottom: '24px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="act-btn" onClick={handleLike} style={{ ...btnStyle(liked, '#c41e3a'), padding: '10px 20px', fontSize: '14px', fontWeight: '700' }}>{liked ? '❤️ Liked' : '🤍 Like'} {likeCount > 0 && '(' + likeCount + ')'}</button>
          <button className="act-btn" onClick={handleBookmark} style={{ ...btnStyle(bookmarked, '#f5c518'), padding: '10px 20px', fontSize: '14px', fontWeight: '700', color: bookmarked ? '#1a1a1a' : '#333' }}>🔖 {bookmarked ? 'Saved' : 'Save'}</button>
          <button className="act-btn" onClick={handleShare} style={{ ...btnStyle(false, '#333'), padding: '10px 20px', fontSize: '14px', fontWeight: '700' }}>🔗 {shareMsg || 'Share'}</button>
          <a href={'https://wa.me/?text=' + encodeURIComponent(article.title + ' ' + (typeof window !== 'undefined' ? window.location.href : ''))} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <button className="act-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#25D366', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '24px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>💬 WhatsApp</button>
          </a>
        </div>

        {/* COMMENTS */}
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '24px 28px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: isDarkMode ? '#fff' : '#1a1a1a', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #f5c518', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💬 Comments <span style={{ fontSize: '14px', fontWeight: '600', color: isDarkMode ? '#aaa' : '#888' }}>({comments.length})</span>
          </h3>

          {/* NEW COMMENT */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', alignItems: 'flex-start' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: user ? '#c41e3a' : '#ddd', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0, marginTop: '4px' }}>
              {user ? getInitials(user.name) : '?'}
            </div>
            <div style={{ flex: 1 }}>
              <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={user ? 'Write a comment...' : 'Login to comment'} disabled={!user} rows={3} style={{ width: '100%', padding: '12px 14px', border: '1px solid ' + (isDarkMode ? '#444' : '#ddd'), borderRadius: '12px', fontSize: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fafafa', color: isDarkMode ? '#fff' : '#1a1a1a', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                {!user && <Link href="/auth" style={{ color: '#c41e3a', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>Login to comment ?</Link>}
                {user && <button onClick={handlePost} disabled={posting || !newComment.trim()} style={{ backgroundColor: posting ? '#999' : '#c41e3a', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', marginLeft: 'auto' }}>{posting ? 'Posting...' : 'Post Comment'}</button>}
              </div>
            </div>
          </div>

          {/* COMMENTS LIST */}
          {topLevelComments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: isDarkMode ? '#666' : '#ccc' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>💬</div>
              <p style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>No comments yet</p>
              <p style={{ fontSize: '13px', margin: '4px 0 0' }}>Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {topLevelComments.map((c: any) => {
                const replies = getReplies(c.$id);
                const isReplying = replyingTo === c.$id;
                const canDelete = user && (user.$id === c.userId || isAdmin);
                return (
                  <div key={c.$id}>
                    {/* COMMENT */}
                    <div style={{ display: 'flex', gap: '10px', padding: '14px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9', borderRadius: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', flexShrink: 0 }}>
                        {getInitials(c.authorName || 'U')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                          <Link href={"/profile/" + c.userId} style={{ textDecoration: "none", color: "inherit" }}><div style={{ fontWeight: '700', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a', cursor: "pointer" }}>{c.authorName || 'Anonymous'}</div></Link>
                          {c.createdAt && <div style={{ fontSize: '11px', color: isDarkMode ? '#666' : '#bbb' }}>{fmtDate(c.createdAt)}</div>}
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '14px', color: isDarkMode ? '#ccc' : '#444', lineHeight: '1.5' }}>{c.commentText}</p>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {replies.length > 0 && <span style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#aaa' }}>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>}
                         <button className="reply-btn" onClick={() => handleCommentLike(c.$id)} style={{ color: likedComments.has(c.$id) ? "#c41e3a" : "#888" }}>
  {likedComments.has(c.$id) ? "❤️" : "🤍"} {commentLikes[c.$id] || 0}
</button> {user && (
                            <button className="reply-btn" onClick={() => { setReplyingTo(isReplying ? null : c.$id); setReplyText(''); }} style={{ color: '#c41e3a' }}>
                              {isReplying ? 'Cancel' : '↩️ Reply'}
                            </button>
                          )}
                          {canDelete && (
                            <button className="del-btn" onClick={() => handleDelete(c.$id)}>🗑️ Delete</button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* REPLY INPUT */}
                    {isReplying && user && (
                      <div style={{ marginLeft: '46px', marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0, marginTop: '4px' }}>
                          {getInitials(user.name)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={'Reply to ' + (c.authorName || 'Anonymous') + '...'} rows={2} style={{ width: '100%', padding: '10px 12px', border: '1px solid ' + (isDarkMode ? '#444' : '#ddd'), borderRadius: '10px', fontSize: '13px', backgroundColor: isDarkMode ? '#2a2a2a' : '#fafafa', color: isDarkMode ? '#fff' : '#1a1a1a', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setReplyingTo(null); setReplyText(''); }} style={{ backgroundColor: isDarkMode ? '#333' : '#f0f0f0', color: isDarkMode ? '#ddd' : '#333', border: 'none', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>Cancel</button>
                            <button onClick={() => handleReply(c.$id)} disabled={postingReply || !replyText.trim()} style={{ backgroundColor: postingReply ? '#999' : '#c41e3a', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '16px', cursor: 'pointer', fontWeight: '700', fontSize: '12px' }}>
                              {postingReply ? 'Posting...' : 'Reply'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* REPLIES */}
                    {replies.length > 0 && (
                      <div style={{ marginLeft: '46px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {replies.map((r: any) => {
                          const canDeleteReply = user && (user.$id === r.userId || isAdmin);
                          return (
                            <div key={r.$id} style={{ display: 'flex', gap: '8px', padding: '10px 12px', backgroundColor: isDarkMode ? '#333' : '#f0f0f0', borderRadius: '8px', borderLeft: '3px solid #c41e3a' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#a01830', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                                {getInitials(r.authorName || 'U')}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                  <Link href={"/profile/" + r.userId} style={{ textDecoration: "none", color: "inherit" }}><div style={{ fontWeight: '700', fontSize: '13px', color: isDarkMode ? '#fff' : '#1a1a1a', cursor: "pointer" }}>{r.authorName || 'Anonymous'}</div></Link>
                                  {r.createdAt && <div style={{ fontSize: '10px', color: isDarkMode ? '#666' : '#bbb' }}>{fmtDate(r.createdAt)}</div>}
                                </div>
                                <p style={{ margin: '0 0 4px', fontSize: '13px', color: isDarkMode ? '#ccc' : '#444', lineHeight: '1.4' }}>{r.commentText}</p>
                                {canDeleteReply && (
                                  <button className="del-btn" onClick={() => handleDelete(r.$id)} style={{ fontSize: '11px' }}>🗑️ Delete</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>


        {/* COPYRIGHT FOOTER */}
        <div style={{ backgroundColor: isDarkMode ? '#2a1518' : '#f9f9f9', borderTop: '2px solid #c41e3a', padding: '24px 28px', marginBottom: '24px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontSize: '13px', color: isDarkMode ? '#aaa' : '#888', fontWeight: '500' }}>
            © {new Date(article.publishedAt || article.$createdAt || new Date()).getFullYear()} Khabar Darjeeling
          </p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }}>
            By {article.submitterName || article.authorName || 'Staff Reporter'}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: isDarkMode ? '#999' : '#aaa', lineHeight: '1.5' }}>
            All rights reserved. Content may not be reproduced without permission.
          </p>
        </div>
        {/* BACK */}
        <div style={{ textAlign: 'center', paddingBottom: '40px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button style={{ backgroundColor: '#c41e3a', color: 'white', padding: '12px 32px', border: 'none', borderRadius: '24px', cursor: 'pointer', fontSize: '15px', fontWeight: '700', boxShadow: '0 4px 12px rgba(196,30,58,0.3)' }}> Back to Home</button>
          </Link>
        </div>
      </div>
    </div>
  );
}



