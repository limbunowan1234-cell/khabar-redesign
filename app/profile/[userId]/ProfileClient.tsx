'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

function getImageUrl(article: any): string {
  const id = article.imageFileId;
  if (!id || ['Text', 'null', 'undefined', ''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return ENDPOINT + '/storage/buckets/article-image/files/' + id + '/view?project=' + PROJECT;
}

const TIERS = [
  { name: 'New Writer', min: 0, max: 50, color: '#888' },
  { name: 'Bronze', min: 50, max: 500, color: '#CD7F32' },
  { name: 'Silver', min: 500, max: 2500, color: '#C0C0C0' },
  { name: 'Gold', min: 2500, max: Infinity, color: '#FFD700' },
];

function getTier(score: number) {
  return TIERS.find((t) => score >= t.min && score < t.max) || TIERS[0];
}

export default function ProfileClient({ userId, initialProfile, initialArticles = [], writerRank = null, contestRank = null }: { userId: string; initialProfile?: any; initialArticles?: any[]; writerRank?: number | null; contestRank?: number | null }) {

  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [articles, setArticles] = useState<any[]>(initialArticles);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [loading, setLoading] = useState(!initialProfile && initialArticles.length === 0);

  useEffect(() => {
    (async () => {
      try {
        const authRes = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        const authData = authRes.ok ? await authRes.json() : null;
        setCurrentUser(authData);

        if (authData?.$id === userId) {
          window.location.href = '/profile';
          return;
        }

        const profileRes = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/profiles/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [userId] })),
          { headers: H, credentials: 'include' }
        );
        const profileData = profileRes.ok ? await profileRes.json() : { documents: [] };
        if (profileData.documents?.[0]) setProfile(profileData.documents[0]);

        const articlesRes = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [userId] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [50] })),
          { headers: H, credentials: 'include' }
        );
        const articlesData = articlesRes.ok ? await articlesRes.json() : { documents: [] };
        const arts = articlesData.documents || [];
        if (arts.length > 0) setArticles(arts);

        // Count total likes across their articles
        let likesSum = 0;
        for (const a of arts) {
          const likesRes = await fetch(
            ENDPOINT + '/databases/' + DB + '/collections/likes/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'articleId', values: [a.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] })),
            { headers: H, credentials: 'include' }
          );
          if (likesRes.ok) {
            const ld = await likesRes.json();
            likesSum += ld.total || 0;
          }
        }
        setTotalLikes(likesSum);

        // Follower count
        const followersRes = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/follows/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followingId', values: [userId] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [1] })),
          { headers: H, credentials: 'include' }
        );
        if (followersRes.ok) {
          const fd = await followersRes.json();
          setFollowerCount(fd.total || 0);
        }

        if (authData?.$id) {
          const followRes = await fetch(
            ENDPOINT + '/databases/' + DB + '/collections/follows/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followerId', values: [authData.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followingId', values: [userId] })),
            { headers: H, credentials: 'include' }
          );
          const followData = followRes.ok ? await followRes.json() : { documents: [] };
          setIsFollowing(followData.documents.length > 0);
        }
      } catch (err) {
        console.error('Load error:', err);
      }
      setLoading(false);
    })();
  }, [userId]);

  const toggleFollow = async () => {
    if (!currentUser) {
      window.location.href = '/auth';
      return;
    }
    try {
      if (isFollowing) {
        const followRes = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/follows/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followerId', values: [currentUser.$id] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followingId', values: [userId] })),
          { headers: H, credentials: 'include' }
        );
        const followData = await followRes.json();
        const followId = followData.documents?.[0]?.$id;
        if (followId) {
          await fetch(ENDPOINT + '/databases/' + DB + '/collections/follows/documents/' + followId, {
            method: 'DELETE', headers: H, credentials: 'include',
          });
          setIsFollowing(false);
          setFollowerCount((c) => Math.max(0, c - 1));
        }
      } else {
        await fetch(ENDPOINT + '/databases/' + DB + '/collections/follows/documents', {
          method: 'POST',
          headers: { ...H, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ documentId: 'unique()', data: { followerId: currentUser.$id, followingId: userId, followerName: currentUser.name, createdAt: new Date().toISOString() } }),
        });
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch (err) {
      console.error('Follow error:', err);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid #eee', borderTopColor: '#c41e3a', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if ((!profile || articles.length === 0) && !initialProfile && (!initialArticles || initialArticles.length === 0)) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#fff' }}>
      <div style={{ fontSize: '40px' }}>👤</div>
      <p style={{ fontSize: '17px', fontWeight: 700, color: '#333' }}>User not found</p>
      <Link href="/" style={{ color: '#c41e3a', fontWeight: 700, textDecoration: 'none' }}>← Back to Home</Link>
    </div>
  );

  const displayName = profile?.displayName || articles[0]?.submitterName || 'User';
  const userName = profile?.userName || displayName.toLowerCase().replace(/\s+/g, '');
  const bio = profile?.bio || '';
  const avatar = profile?.avatarUrl || articles[0]?.submitterAvatar || '';
  const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
  const score = totalViews + totalLikes;
  const tier = getTier(score);
  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const progress = nextTier ? Math.min(100, ((score - tier.min) / (nextTier.min - tier.min)) * 100) : 100;

  const featured = articles[0];
  const rest = articles.slice(1);

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
  const bannerGradient = BANNER_THEMES[profile?.bannerTheme] || BANNER_THEMES.crimson;

  return (
    <div style={{ minHeight: '100vh', background: '#fff', paddingBottom: '100px' }}>
      {/* BANNER */}
      <div style={{ height: '160px', background: bannerGradient, position: 'relative' }}>
        <Link href="/" style={{ position: 'absolute', top: '16px', left: '16px', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: 700, background: 'rgba(0,0,0,0.25)', padding: '6px 14px', borderRadius: '20px' }}>← Back</Link>
        {(writerRank || contestRank) && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {contestRank && (
              <span style={{ background: '#FFD54A', color: '#5A3B00', fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '14px' }}>#{contestRank} Contest</span>
            )}
            {writerRank && (
              <span style={{ background: 'rgba(255,255,255,0.9)', color: '#1a1a1a', fontSize: '11px', fontWeight: 700, padding: '5px 10px', borderRadius: '14px' }}>#{writerRank} Writer</span>
            )}
          </div>
        )}

      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 16px' }}>
        {/* AVATAR (overlapping banner) */}
        <div style={{ marginTop: '-52px', marginBottom: '12px', position: 'relative', zIndex: 10 }}>
          <div style={{ width: '104px', height: '104px', borderRadius: '50%', border: '4px solid #fff', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '42px', fontWeight: 800, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            {avatar ? <img src={avatar} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayName[0].toUpperCase()}
          </div>
        </div>

        {/* NAME + FOLLOW */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <h1 style={{ margin: '0 0 2px', fontSize: '24px', fontWeight: 800, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {displayName}
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: tier.color, padding: '3px 10px', borderRadius: '12px' }}>{tier.name}</span>
            </h1>
            <p style={{ margin: 0, color: '#657786', fontSize: '15px' }}>@{userName}</p>
          </div>
          <button onClick={toggleFollow} style={{ background: isFollowing ? '#fff' : '#c41e3a', color: isFollowing ? '#c41e3a' : '#fff', border: '1.5px solid #c41e3a', padding: '8px 22px', borderRadius: '20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>

        {bio && <p style={{ margin: '12px 0', color: '#1a1a1a', fontSize: '15px', lineHeight: 1.5 }}>{bio}</p>}

        {/* STATS ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', margin: '16px 0' }}>
          {[
            { label: 'Articles', value: articles.length },
            { label: 'Followers', value: followerCount },
            { label: 'Views', value: totalViews.toLocaleString() },
            { label: 'Likes', value: totalLikes },
          ].map((s, i) => (
            <div key={s.label} className="public-stat-card" style={{ animationDelay: (i * 0.07) + 's', background: '#f7f7f7', border: '1px solid #eee', borderRadius: '12px', padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a1a' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>



        {/* TIER PROGRESS */}
        <div style={{ background: '#f7f7f7', borderRadius: '14px', padding: '16px', margin: '16px 0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: tier.color }}>● {tier.name}</span>
            <span style={{ fontSize: '12px', color: '#888' }}>{score.toLocaleString()} pts</span>
          </div>
          <div style={{ height: '8px', background: '#e5e5e5', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: progress + '%', height: '100%', background: 'linear-gradient(90deg, ' + tier.color + ', #f5c518)', borderRadius: '4px', transition: 'width 0.6s' }} />
          </div>
          {nextTier && (
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#888' }}>
              {(nextTier.min - score).toLocaleString()} pts to <b style={{ color: nextTier.color }}>{nextTier.name}</b>
            </p>
          )}
        </div>

        {/* ARTICLE GALLERY */}
        {articles.length > 0 && (() => {
          const showSections = articles.length > 6;
          const mostViewed = showSections ? [...articles].sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).slice(0, 4) : [];
          const renderCard = (article: any) => {
            const img = getImageUrl(article);
            return (
              <Link key={article.$id} href={'/article/' + (article.slug || article.$id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="profile-grid-card" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ height: '120px', background: img ? '#e5e5e5' : 'linear-gradient(135deg, #c41e3a 0%, #a01830 60%, #f5c518 140%)', position: 'relative' }}>
                    {img ? <img src={img} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', textAlign: 'center' }}><span style={{ color: '#fff', fontSize: '12px', fontWeight: 700, opacity: 0.9 }}>{article.title}</span></div>}
                    <span style={{ position: 'absolute', top: '8px', left: '8px', background: '#c41e3a', color: '#fff', padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}>{article.category}</span>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</h3>
                    <p style={{ margin: 0, fontSize: '10px', color: '#999' }}>{(article.views || 0).toLocaleString()} views</p>
                  </div>
                </div>
              </Link>
            );
          };
          if (!showSections) {
            return (
              <>
                <p style={{ fontSize: '12px', fontWeight: 800, color: '#657786', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>Articles</p>
                <div className="profile-news-grid">
                  {articles.map(renderCard)}
                </div>
              </>
            );
          }
          return (
            <>
              <p style={{ fontSize: '12px', fontWeight: 800, color: '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>Most Viewed</p>
              <div className="profile-news-grid" style={{ marginBottom: '28px' }}>
                {mostViewed.map(renderCard)}
              </div>

              <p style={{ fontSize: '12px', fontWeight: 800, color: '#657786', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>Latest</p>
              <div className="profile-news-grid">
                {articles.map(renderCard)}
              </div>
            </>
          );
        })()}
      </div>

      <style>{`
        .profile-news-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} .public-stat-card{animation:fadeSlideUp 0.5s ease both}
        .profile-grid-card { transition: transform 0.15s, box-shadow 0.15s; }
        .profile-grid-card:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,0.12); }
        @media (min-width: 768px) {
          .profile-news-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
    </div>
  );
}


