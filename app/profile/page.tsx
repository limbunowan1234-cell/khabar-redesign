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
function getImageUrl(a: any): string {
  const id = a?.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return ENDPOINT + '/storage/buckets/article-image/files/' + id + '/view?project=' + PROJECT;
}



async function fetchArticleByIdOrSlug(aid: string, endpoint: string, db: string, headers: any): Promise<any> {
  const looksLikeSlug = /-/.test(aid) || aid.length > 36;
  if (!looksLikeSlug) {
    try {
      const r = await fetch(endpoint + '/databases/' + db + '/collections/articles/documents/' + aid, { headers, credentials: 'include' });
      if (r.ok) return await r.json();
    } catch {}
  }
  try {
    const q = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'slug', values: [aid] }));
    const r2 = await fetch(endpoint + '/databases/' + db + '/collections/articles/documents?queries[]=' + q, { headers, credentials: 'include' });
    if (r2.ok) {
      const d = await r2.json();
      return d.documents?.[0] || null;
    }
  } catch {}
  return null;
}



export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profileDoc, setProfileDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [myArticles, setMyArticles] = useState<any[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [activeTab, setActiveTab] = useState('articles');
  const [favorites, setFavorites] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [writerRank, setWriterRank] = useState<number | null>(null);
  const [contestRank, setContestRank] = useState<number | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const userRes = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        if (!userRes.ok) { router.push('/auth'); return; }
        const userData = await userRes.json();
        setUser(userData);

        try {
          const pq = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userData.$id] }));
          const profRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/profiles/documents?queries[]=' + pq, { headers: H, credentials: 'include' });
          if (profRes.ok) { const pd = await profRes.json(); setProfileDoc(pd.documents?.[0] || null); }
        } catch {}

        const [articlesRes, followersRes, followingRes, bookmarksRes] = await Promise.all([
          fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [userData.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [20] })) + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'select', values: ['$id','$createdAt','title','genre','category','locationDistrict','imageFileId','youtube_id','views','isContestEntry','isFeatured','isBreaking','publishedAt','slug','status','submitterName','authorName'] })),
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


        // Recent activity feed
        try {
          const actRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/notifications/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userData.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'orderDesc', attribute: 'createdAt' })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [5] })),
            { headers: H, credentials: 'include' });
          if (actRes.ok) { const ad = await actRes.json(); setRecentActivity(ad.documents || []); }
        } catch {}


          // Load FAVORITES (liked articles)
          try {
            const likesRes = await fetch(ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' +
              encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userData.$id] })) +
              '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })),
              { headers: H, credentials: 'include' });
            if (likesRes.ok) {
              const ld = await likesRes.json();
              const ids = (ld.documents || []).map((x: any) => x.articleId).filter(Boolean);
        const arts = ids.length ? await (async () => { const bq = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: '$id', values: ids.slice(0, 100) })) + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })); const br = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + bq, { headers: H, credentials: 'include' }); if (!br.ok) return []; const bd2 = await br.json(); return bd2.documents || []; })() : [];
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
        const arts = ids.length ? await (async () => { const bq = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: '$id', values: ids.slice(0, 100) })) + '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [100] })); const br = await fetch(ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' + bq, { headers: H, credentials: 'include' }); if (!br.ok) return []; const bd2 = await br.json(); return bd2.documents || []; })() : [];
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

  const BANNER_THEMES: Record<string, string> = {
    crimson: 'linear-gradient(135deg, #c41e3a 0%, #7a1220 100%)',
    evergreen: 'linear-gradient(135deg, #2e7d32 0%, #1b4d1f 100%)',
    glacier: 'linear-gradient(135deg, #0ea5e9 0%, #0c4a6e 100%)',
    golden: 'linear-gradient(135deg, #f59e0b 0%, #92400e 100%)',
    royal: 'linear-gradient(135deg, #9333ea 0%, #4c1d95 100%)',
    midnight: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    sunrise: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)',
    slate: 'linear-gradient(135deg, #64748b 0%, #334155 100%)',
  };
  const bannerGradient = BANNER_THEMES[profileDoc?.bannerTheme] || BANNER_THEMES.crimson;


  return (
    <div style={{ minHeight: '100vh', backgroundColor: isDarkMode ? '#121212' : '#f0f2f5' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeSlideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} .stat-card-anim{animation:fadeSlideUp 0.5s ease both} .action-card{transition:transform 0.15s,box-shadow 0.15s} .action-card:hover{transform:translateY(-3px);box-shadow:0 6px 18px rgba(0,0,0,0.2)}`}</style>

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
      <div style={{ background: bannerGradient, padding: '40px 20px 60px', color: 'white', textAlign: 'center' }}>
        <ProfileEditor userId={user.$id} userName={user.name} />
        <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>{user.name}</h1>
        <p style={{ fontSize: '14px', opacity: 0.95, margin: '0 0 20px', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>{user.email}</p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><AuthorBadge submitterId={user.$id} size="md" /></div>
            <TierProgress userId={user.$id} />
          <ProfileBio userId={user.$id} />
        {(writerRank || contestRank) && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', margin: '4px 0 16px' }}>
            {writerRank && (
              <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '16px' }}>
                #{writerRank} Writer {writerRank === 1 ? String.fromCodePoint(0x1F389) : ''}
              </span>
            )}
            {contestRank && (
              <span style={{ background: 'rgba(255,213,74,0.25)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,213,74,0.5)', color: '#FFD54A', fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '16px' }}>
                #{contestRank} Contest {String.fromCodePoint(0x1F3C6)}
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: 'Articles', value: myArticles.length },
            { label: 'Followers', value: followers.length },
            { label: 'Following', value: following.length },
            { label: 'Bookmarks', value: bookmarkCount },
          ].map((stat, i) => (
            <div key={stat.label} className="stat-card-anim" style={{ animationDelay: (i * 0.08) + 's', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '12px 20px', minWidth: '80px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#f5c518' }}>{stat.value}</div>
              <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>{stat.label}</div>
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
              <div className='action-card' style={{ backgroundColor: item.color, color: item.textColor || 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>{item.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: '700' }}>{item.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* RECENT ACTIVITY */}
        {recentActivity.length > 0 && (
          <div style={{ backgroundColor: isDarkMode ? '#1e1e1e' : 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '16px 20px', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>Recent Activity</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentActivity.map((n: any) => (
                <div key={n.$id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: n.read ? '#ccc' : '#c41e3a', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '13px', color: isDarkMode ? '#ddd' : '#333' }}>{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}


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
                    <Link key={a.$id} href={'/article/' + (a.slug || a.$id)} style={{ textDecoration: 'none', color: 'inherit' }}>
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

            {/* FAVORITES */}
            {activeTab === 'favorites' && (
              favorites.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: isDarkMode ? '#666' : '#ccc' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>heart</div>
                  <p style={{ fontWeight: '600', margin: 0, color: isDarkMode ? '#aaa' : '#666' }}>No favorites yet</p>
                  <p style={{ fontSize: '13px', margin: '8px 0 0', color: isDarkMode ? '#666' : '#aaa' }}>Like articles to save them here!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {favorites.map((a: any) => (
                    <Link key={a.$id} href={'/article/' + (a.slug || a.$id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ display: 'flex', gap: '12px', padding: '12px', backgroundColor: isDarkMode ? '#2a2a2a' : '#f9f9f9', borderRadius: '10px', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: isDarkMode ? '#fff' : '#1a1a1a', marginBottom: '4px' }}>{a.title}</div>
                          <div style={{ fontSize: '12px', color: isDarkMode ? '#888' : '#aaa' }}>{a.category} - {(a.views || 0).toLocaleString()} views</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            )}

            {/* BOOKMARKS */}
            {activeTab === 'bookmarks' && (
              bookmarks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: isDarkMode ? '#666' : '#ccc' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔖</div>
                  <p style={{ fontWeight: '600', margin: 0, color: isDarkMode ? '#aaa' : '#666' }}>No bookmarks yet</p>
                  <p style={{ fontSize: '13px', margin: '8px 0 0', color: isDarkMode ? '#666' : '#aaa' }}>Save articles to read later!</p>
                </div>
              ) : (
                <div className="profile-grid-3col">
                  {bookmarks.map((a: any) => {
                    const img = getImageUrl(a);
                    return (
                      <Link key={a.$id} href={'/article/' + (a.slug || a.$id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid ' + (isDarkMode ? '#333' : '#eee'), backgroundColor: isDarkMode ? '#2a2a2a' : '#fff' }}>
                          <div style={{ height: '100px', position: 'relative', background: img ? '#e5e5e5' : 'linear-gradient(135deg, #c41e3a 0%, #a01830 60%, #f5c518 140%)' }}>
                            {img ? <img src={img} alt={a.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', textAlign: 'center' }}><span style={{ color: '#fff', fontSize: '11px', fontWeight: 700, opacity: 0.9 }}>{a.title}</span></div>}
                          </div>
                          <div style={{ padding: '10px' }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: isDarkMode ? '#fff' : '#1a1a1a', marginBottom: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</div>
                            <div style={{ fontSize: '11px', color: isDarkMode ? '#888' : '#999' }}>{a.category} &middot; {(a.views || 0).toLocaleString()} views</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

              )
            )}
        </div>

        {/* LOGOUT */}
        <button onClick={handleLogout} style={{ width: '100%', padding: '14px', backgroundColor: '#ffebee', color: '#c41e3a', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', marginTop: '20px' }}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
