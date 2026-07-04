'use client';
import ProfileEditor from '@/components/ProfileEditor';
import ProfileBio from '@/components/ProfileBio';
import AuthorBadge from '@/components/AuthorBadge';
import TierProgress from '@/components/TierProgress';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const H = { 'X-Appwrite-Project': PROJECT };
const HJ = { 'X-Appwrite-Project': PROJECT, 'Content-Type': 'application/json' };
const DB = 'Khabar_db';

function getInitials(name: string): string {
  if (!name) return 'KD';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

function fmtDate(s: string): string {
  try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [myArticles, setMyArticles] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [activeTab, setActiveTab] = useState('articles');
  const [favorites, setFavorites] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const userRes = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        if (!userRes.ok) { router.push('/auth'); return; }
        const userData = await userRes.json();
        setUser(userData);

        const [articlesRes, followersRes, followingRes, bookmarksRes] = await Promise.all([
          fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [userData.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [20] })),
            { headers: H, credentials: 'include' }),
          fetch(ENDPOINT + '/databases/' + DB + '/collections/follows/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followingId', values: [userData.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
            { headers: H, credentials: 'include' }),
          fetch(ENDPOINT + '/databases/' + DB + '/collections/follows/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followerId', values: [userData.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
            { headers: H, credentials: 'include' }),
          fetch(ENDPOINT + '/databases/' + DB + '/collections/bookmarks/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userData.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] })),
            { headers: H, credentials: 'include' }),
        ]);

        if (articlesRes.ok) { const d = await articlesRes.json(); setMyArticles(d.documents || []); }
        if (followersRes.ok) { const d = await followersRes.json(); setFollowers(d.documents || []); }
        if (followingRes.ok) { const d = await followingRes.json(); setFollowing(d.documents || []); }
        if (bookmarksRes.ok) { const d = await bookmarksRes.json(); setBookmarkCount(d.total || 0); }

          // Load FAVORITES (liked articles)
          try {
            const likesRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' +
              encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userData.$id] })) +
              '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
              { headers: H, credentials: 'include' });
            if (likesRes.ok) {
              const ld = await likesRes.json();
              const ids = (ld.documents || []).map((x: any) => x.articleId).filter(Boolean);
              const arts = await Promise.all(ids.map(async (aid: string) => {
                const r = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents/' + aid, { headers: H, credentials: 'include' });
                return r.ok ? await r.json() : null;
              }));
              setFavorites(arts.filter(Boolean));
            }
          } catch {}

          // Load BOOKMARKS (saved articles)
          try {
            const bmRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/bookmarks/documents?queries[]=' +
              encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userData.$id] })) +
              '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
              { headers: H, credentials: 'include' });
            if (bmRes.ok) {
              const bd = await bmRes.json();
              const ids = (bd.documents || []).map((x: any) => x.articleId).filter(Boolean);
              const arts = await Promise.all(ids.map(async (aid: string) => {
                const r = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents/' + aid, { headers: H, credentials: 'include' });
                return r.ok ? await r.json() : null;
              }));
              setBookmarks(arts.filter(Boolean));
            }
          } catch {}
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await fetch(ENDPOINT + '/account/sessions/current', { method: 'DELETE', headers: H, credentials: 'include' }).catch(() => {});
    router.push('/');
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #c41e3a, #a01830)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p>Loading profile...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* HEADER */}
      <header style={{ backgroundColor: isDarkMode ? '#1e1e1e' : '#c41e3a', color: 'white', padding: '12px 20px', borderBottom: '3px solid #f5c518', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/assets/logo.png" alt="logo" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span style={{ fontWeight: '800', fontSize: '16px' }}>खबर दार्जिलिंग</span>
          </Link>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/" style={{ textDecoration: 'none' }}><button style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>← Home</button></Link>
            <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', fontSize: '15px' }}>{isDarkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </header>

      {/* PROFILE HERO */}
      <div style={{ background: 'linear-gradient(135deg, #c41e3a 0%, #a01830 100%)', padding: '40px 20px 60px', color: 'white', textAlign: 'center' }}>
        <ProfileEditor userId={user.$id} userName={user.name} />
        <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px' }}>{user.name}</h1>
        <p style={{ fontSize: '14px', opacity: 0.85, margin: '0 0 20px' }}>{user.email}</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><AuthorBadge submitterId={user.$id} size="md" /></div>
            <TierProgress userId={user.$id} />
          <ProfileBio userId={user.$id} />
        <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Articles', value: myArticles.length },
            { label: 'Followers', value: followers.length },
            { label: 'Following', value: following.length },
            { label: 'Bookmarks', value: bookmarkCount },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#f5c518' }}>{stat.value}</div>
              <div style={{ fontSize: '12px', opacity: 0.85 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '-20px auto 0', padding: '0 16px 40px' }}>

        {/* QUICK ACTIONS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {[
            { href: '/post', icon: '✍️', label: 'Create Post', color: '#c41e3a' },
            { href: '/bookmarks', icon: '🔖', label: 'Bookmarks', color: '#f5c518', textColor: '#1a1a1a' },
            { href: '/contest', icon: '🏆', label: 'Contest', color: '#a01830' },
            { href: '/admin', icon: '⚙️', label: 'Admin Panel', color: '#1a1a1a' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{ backgroundColor: item.color, color: item.textColor || 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>{item.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '700' }}>{item.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* TABS */}
        <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid ' + (isDarkMode ? '#333' : '#f0f0f0') }}>
            {[
              { id: 'articles', label: '📰 My Articles (' + myArticles.length + ')' },
              { id: 'followers', label: '👥 Followers (' + followers.length + ')' },
              { id: 'following', label: '➕ Following (' + following.length + ')' },
              { id: 'favorites', label: 'Favorites (' + favorites.length + ')' },
              { id: 'bookmarks', label: 'Bookmarks (' + bookmarks.length + ')' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, padding: '14px 8px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: activeTab === tab.id ? '#c41e3a' : isDarkMode ? '#888' : '#666', borderBottom: activeTab === tab.id ? '3px solid #c41e3a' : '3px solid transparent', transition: 'all 0.2s' }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '20px' }}>
            {/* MY ARTICLES */}
            {activeTab === 'articles' && (
              myArticles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: isDarkMode ? '#666' : '#ccc' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>📰</div>
                  <p style={{ fontWeight: '600', margin: '0 0 16px', color: isDarkMode ? '#aaa' : '#666' }}>No articles yet</p>
                  <Link href="/post" style={{ textDecoration: 'none' }}>
                    <button style={{ backgroundColor: '#c41e3a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}>Write Your First Article</button>
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {myArticles.map((a: any) => (
                    <Link key={a.$id} href={'/article/' + a.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', gap: '12px', padding: '12px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9', borderRadius: '10px', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a', marginBottom: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#aaa', display: 'flex', gap: '10px' }}>
                            <span>{a.category}</span>
                            <span>{fmtDate(a.publishedAt || a.$createdAt)}</span>
                            <span>👁 {(a.views || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                          {a.isBreaking && <span style={{ backgroundColor: '#ffebee', color: '#c41e3a', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>BREAKING</span>}
                          {a.isFeatured && <span style={{ backgroundColor: '#fff8e1', color: '#b8860b', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>FEATURED</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            )}

            {/* FOLLOWERS */}
            {activeTab === 'followers' && (
              followers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: isDarkMode ? '#666' : '#ccc' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
                  <p style={{ fontWeight: '600', margin: 0, color: isDarkMode ? '#aaa' : '#666' }}>No followers yet</p>
                  <p style={{ fontSize: '13px', margin: '8px 0 0', color: isDarkMode ? '#666' : '#aaa' }}>Share your articles to gain followers!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {followers.map((f: any) => (
                    <div key={f.$id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9', borderRadius: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 }}>
                        {getInitials(f.followerName || 'U')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{f.followerName || 'User'}</div>
                        <div style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#aaa' }}>Followed {fmtDate(f.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* FOLLOWING */}
            {activeTab === 'following' && (
              following.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: isDarkMode ? '#666' : '#ccc' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>➕</div>
                  <p style={{ fontWeight: '600', margin: 0, color: isDarkMode ? '#aaa' : '#666' }}>Not following anyone yet</p>
                  <p style={{ fontSize: '13px', margin: '8px 0 0', color: isDarkMode ? '#666' : '#aaa' }}>Follow reporters to see their articles!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {following.map((f: any) => (
                    <div key={f.$id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9', borderRadius: '10px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#a01830', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', flexShrink: 0 }}>
                        {getInitials(f.followingName || 'U')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a' }}>{f.followingName || 'User'}</div>
                        <div style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#aaa' }}>Following since {fmtDate(f.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* LOGOUT */}
        <button onClick={handleLogout} style={{ width: '100%', padding: '14px', backgroundColor: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', marginTop: '20px' }}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
