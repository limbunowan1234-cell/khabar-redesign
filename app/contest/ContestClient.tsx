'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': PROJECT };
const DB = 'Khabar_db';

function getImageUrl(a: any): string {
  const id = a.imageFileId;
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
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

export default function ContestClient({ initialEntries = [] }: { initialEntries?: any[] }) {
  const [entries, setEntries] = useState<any[]>(initialEntries);
  const [loading, setLoading] = useState(initialEntries.length === 0);
  const [user, setUser] = useState<any>(null);
  const [sortBy, setSortBy] = useState('score');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [likedMap, setLikedMap] = useState<any>({});

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
              const articleLikes = (likesData.documents || []).filter((l: any) => !l.commentId).length;
              return { ...a, _votes: articleLikes, _comments: commentCount };
              }
            } catch {}
            return { ...a, _votes: 0 };
          }));
          if (withVotes.length > 0) setEntries(withVotes);

          try {
            const liked = JSON.parse(localStorage.getItem('kd_liked') || '{}');
            setLikedMap(liked);
          } catch {}
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function handleVote(articleId: string) {
    if (!user) { window.location.href = '/auth'; return; }
    const isLiked = !!likedMap[articleId];
    const newLikedMap = { ...likedMap };

    if (isLiked) {
      delete newLikedMap[articleId];
      setLikedMap(newLikedMap);
      localStorage.setItem('kd_liked', JSON.stringify(newLikedMap));
      setEntries(prev => prev.map(a => a.$id === articleId ? { ...a, _votes: Math.max(0, (a._votes || 1) - 1) } : a));
      try {
        const res = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [articleId] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [user.$id] })),
          { headers: H, credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          if (data.documents?.[0]) {
            await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents/' + data.documents[0].$id, { method: 'DELETE', headers: H, credentials: 'include' });
          }
        }
      } catch {}
    } else {
      newLikedMap[articleId] = true;
      setLikedMap(newLikedMap);
      localStorage.setItem('kd_liked', JSON.stringify(newLikedMap));
      setEntries(prev => prev.map(a => a.$id === articleId ? { ...a, _votes: (a._votes || 0) + 1 } : a));
      try {
        await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents', {
          method: 'POST',
          headers: { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ documentId: 'unique()', data: { articleId, userId: user.$id, commentId: null } })
        });
      } catch {}
    }
  }

  function calcScore(a: any): number {
    const views = (a.views || 0) * 0.5;
    const likes = (a._votes || 0) * 1;
    const comments = (a._comments || 0) * 3;
    const shares = (a._shares || 0) * 0.2;
    return views + likes + comments + shares;
  }
  const sorted = [...entries].sort((a, b) => {
    if (sortBy === "score") return calcScore(b) - calcScore(a);
    if (sortBy === "votes") return (b._votes || 0) - (a._votes || 0);
    if (sortBy === "views") return (b.views || 0) - (a.views || 0);
    return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
  });

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #c41e3a, #a01830)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <img src="/assets/logo.png" alt="logo" style={{ width: '70px', height: '70px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.4)', marginBottom: '20px' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'rgba(255,255,255,0.8)', marginTop: '16px', fontSize: '14px' }}>Loading contest...</p>
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
          <div style={{ fontSize: "36px", fontWeight: "800", color: "#f5c518" }}>₹10,000 Prize Pool</div>
          <p style={{ margin: "8px 0 20px", fontSize: "16px", opacity: 0.95 }}>Theme: <strong>Life After Election</strong> • Deadline: July 31, 2026</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/post" style={{ textDecoration: "none" }}>
              <button style={{ backgroundColor: "#f5c518", color: "#1a1a1a", border: "none", padding: "12px 28px", borderRadius: "30px", fontWeight: "800", fontSize: "15px", cursor: "pointer" }}>✍️ Submit Your Story</button>
            </Link>
            <a href="#leaderboard" style={{ textDecoration: "none" }}>
              <button style={{ backgroundColor: "transparent", color: "white", border: "2px solid rgba(255,255,255,0.6)", padding: "12px 28px", borderRadius: "30px", fontWeight: "700", fontSize: "15px", cursor: "pointer" }}>📚 View Entries</button>
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
            { icon: '📝', label: 'Rules', value: 'No Limits!' },
            { icon: '👥', label: 'Entries', value: entries.length + ' Stories' },
          ].map(card => (
            <div key={card.label} style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>{card.icon}</div>
              <div style={{ fontSize: '11px', color: isDarkMode ? '#aaa' : '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{card.label}</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* HOW TO ENTER */}
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: isDarkMode ? '#fff' : '#c41e3a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '4px', height: '20px', backgroundColor: '#f5c518', borderRadius: '2px', display: 'inline-block' }} />
            How to Enter
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {[
              { step: '1', title: 'Create Account', desc: 'Sign up or login to KhabarDarjeeling' },
              { step: '2', title: 'Write Your Story', desc: 'Click "Create Post" and write about Life After Election' },
              { step: '3', title: 'Mark as Contest Entry', desc: 'Check the Contest Entry box before publishing' },
              { step: '4', title: 'Get Votes!', desc: 'Share your story and collect votes from readers' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '14px', flexShrink: 0 }}>{s.step}</div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a', marginBottom: '4px' }}>{s.title}</div>
                  <div style={{ fontSize: '13px', color: isDarkMode ? '#aaa' : '#666', lineHeight: '1.4' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LEADERBOARD */}
        <div id="leaderboard">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: isDarkMode ? '#fff' : '#c41e3a', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <span style={{ width: '4px', height: '20px', backgroundColor: '#f5c518', borderRadius: '2px', display: 'inline-block' }} />
              Live Leaderboard <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%', marginLeft: '4px' }} />
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[['score', '🏆 Score'], ['votes', '❤️ Votes'], ['views', '👁 Views'], ['newest', '🆕 Newest']].map(([val, label]) => (
                <button key={val} onClick={() => setSortBy(val)} style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', backgroundColor: sortBy === val ? '#c41e3a' : isDarkMode ? '#2a2a2a' : '#f5f5f5', color: sortBy === val ? 'white' : isDarkMode ? '#aaa' : '#666' }}>{label}</button>
              ))}
            </div>
          </div>

          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <p style={{ fontSize: '18px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', margin: '0 0 8px' }}>No entries yet!</p>
              <p style={{ fontSize: '14px', color: isDarkMode ? '#aaa' : '#666', margin: '0 0 20px' }}>Be the first to submit your story</p>
              <Link href="/post" style={{ textDecoration: 'none' }}>
                <button style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>✍️ Submit Now</button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '40px' }}>
              {sorted.map((a, i) => {
                const imgUrl = getImageUrl(a);
                const author = a.submitterName || a.authorName || 'Anonymous';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                const isLiked = !!likedMap[a.$id];
                return (
                  <div key={a.$id} style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '14px', overflow: 'hidden', boxShadow: i < 3 ? '0 4px 16px rgba(196,30,58,0.15)' : '0 2px 8px rgba(0,0,0,0.08)', border: i < 3 ? '2px solid ' + (i === 0 ? '#f5c518' : i === 1 ? '#c0c0c0' : '#cd7f32') : 'none', position: 'relative', transition: 'transform 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>

                    {/* RANK BADGE */}
                    <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, backgroundColor: i < 3 ? 'transparent' : '#c41e3a', color: i < 3 ? 'transparent' : 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: i < 3 ? '24px' : '13px', fontWeight: '800' }}>
                      {medal || (i + 1)}
                    </div>

                    {/* IMAGE */}
                    <Link href={'/article/' + a.$id} style={{ textDecoration: 'none', display: 'block' }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt={a.title} style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ width: '100%', height: '140px', background: 'linear-gradient(135deg, #c41e3a, #a01830)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '48px', opacity: 0.3 }}>📰</span>
                        </div>
                      )}
                    </Link>

                    <div style={{ padding: '14px' }}>
                      <Link href={'/article/' + a.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: '1.4', margin: '0 0 8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</h3>
                        <p style={{ fontSize: '13px', color: isDarkMode ? '#bbb' : '#555', lineHeight: '1.4', margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{(a.content || '').substring(0, 100)}...</p>
                      </Link>

                      {/* AUTHOR */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{getInitials(author)}</div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: isDarkMode ? '#ddd' : '#333' }}>{author}</div>
                          <div style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#aaa' }}>{fmtDate(a.$createdAt)}</div>
                        </div>
                      </div>

                      {/* STATS + VOTE */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0') }}>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: isDarkMode ? '#888' : '#aaa' }}>
                          <span>👁 {(a.views || 0).toLocaleString()}</span>
                          <span>❤️ {a._votes || 0}</span>
                          <span>💬 {a._comments || 0}</span>
                          <span style={{ color: "#f5c518", fontWeight: "700" }}>⭐ {Math.round((a.views||0)*0.5 + (a._votes||0)*1 + (a._comments||0)*3).toLocaleString()}</span>
                        </div>
                        <button onClick={() => handleVote(a.$id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: isLiked ? '#c41e3a' : isDarkMode ? '#2a2a2a' : '#f5f5f5', color: isLiked ? 'white' : isDarkMode ? '#ddd' : '#333', border: 'none', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', transition: 'all 0.2s' }}>
                          {isLiked ? '❤️ Voted' : '🤍 Vote'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}






