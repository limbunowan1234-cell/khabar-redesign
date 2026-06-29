'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': PROJECT };
const DB = 'Khabar_db';

function getImageUrl(a: any): string {
  const id = a.imageFileId;
  if (!id || ['Text','null','undefined',''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return ENDPOINT + '/storage/buckets/article-image/files/' + id + '/view?project=' + PROJECT;
}

function fmtDate(s: string): string {
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

export default function BookmarksPage() {
  const [user, setUser] = useState<any>(null);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const userRes = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        if (!userRes.ok) { window.location.href = '/auth'; return; }
        const userData = await userRes.json();
        setUser(userData);

        const bkRes = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/bookmarks/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userData.$id] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [50] })),
          { headers: H, credentials: 'include' }
        );
        if (bkRes.ok) {
          const bkData = await bkRes.json();
          const bks = bkData.documents || [];
          setBookmarks(bks);

          const articlePromises = bks.map((b: any) =>
            fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents/' + b.articleId, { headers: H, credentials: 'include' })
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          );
          const articleData = await Promise.all(articlePromises);
          setArticles(articleData.filter(Boolean));
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function removeBookmark(articleId: string) {
    try {
      const bk = bookmarks.find(b => b.articleId === articleId);
      if (!bk) return;
      await fetch(ENDPOINT + '/databases/' + DB + '/collections/bookmarks/documents/' + bk.$id, {
        method: 'DELETE', headers: H, credentials: 'include'
      });
      setBookmarks(prev => prev.filter(b => b.articleId !== articleId));
      setArticles(prev => prev.filter(a => a.$id !== articleId));
    } catch {}
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #c41e3a, #a01830)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p>Loading bookmarks...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <header style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#c41e3a', color: 'white', padding: '12px 20px', borderBottom: '3px solid #f5c518', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/assets/logo.png" alt="logo" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span style={{ fontWeight: '800', fontSize: '16px' }}>खबर दार्जिलिंग</span>
          </Link>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/profile" style={{ textDecoration: 'none' }}><button style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>← Profile</button></Link>
            <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '15px' }}>{isDarkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <span style={{ width: '4px', height: '24px', backgroundColor: '#f5c518', borderRadius: '2px', display: 'inline-block' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: isDarkMode ? '#fff' : '#c41e3a', margin: 0 }}>🔖 My Bookmarks</h1>
          <span style={{ fontSize: '14px', color: isDarkMode ? '#aaa' : '#888', marginLeft: '8px' }}>({articles.length} saved)</span>
        </div>

        {articles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔖</div>
            <p style={{ fontSize: '18px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', margin: '0 0 8px' }}>No bookmarks yet</p>
            <p style={{ fontSize: '14px', color: isDarkMode ? '#aaa' : '#666', margin: '0 0 20px' }}>Save articles to read them later</p>
            <Link href="/" style={{ textDecoration: 'none' }}>
              <button style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>Browse Articles</button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {articles.map((article: any) => {
              const imgUrl = getImageUrl(article);
              return (
                <div key={article.$id} style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', gap: '0' }}>
                  <div style={{ width: '4px', backgroundColor: '#c41e3a', flexShrink: 0 }} />
                  {imgUrl ? (
                    <img src={imgUrl} alt={article.title} style={{ width: '120px', height: '90px', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '120px', height: '90px', background: 'linear-gradient(135deg, #c41e3a, #a01830)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '24px', opacity: 0.4 }}>📰</span>
                    </div>
                  )}
                  <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                    <div>
                      {article.category && <span style={{ display: 'inline-block', backgroundColor: '#c41e3a22', color: '#c41e3a', padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>{article.category}</span>}
                      <Link href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: '1.4', margin: '0 0 4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</h3>
                      </Link>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#aaa' }}>{article.submitterName || article.authorName || 'Staff'} • {fmtDate(article.publishedAt || article.$createdAt)}</span>
                      <button onClick={() => removeBookmark(article.$id)} style={{ backgroundColor: '#ffebee', color: '#c41e3a', border: 'none', padding: '4px 10px', borderRadius: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>🗑 Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
