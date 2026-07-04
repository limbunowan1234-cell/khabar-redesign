'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';
const DB = 'Khabar_db';
const H = { 'X-Appwrite-Project': PROJECT };

export default function PublicProfile({ params }: { params: { userId: string } }) {
  const [profile, setProfile] = useState<any>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Get current user
        const authRes = await fetch(ENDPOINT + '/account', { headers: H, credentials: 'include' });
        const authData = authRes.ok ? await authRes.json() : null;
        setCurrentUser(authData);

        // If viewing own profile, they should use /profile instead
        if (authData?.$id === params.userId) {
          window.location.href = '/profile';
          return;
        }

        // Get profile data
        const profileRes = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/profiles/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'userId', values: [params.userId] })),
          { headers: H, credentials: 'include' }
        );
        const profileData = profileRes.ok ? await profileRes.json() : { documents: [] };
        const userProfile = profileData.documents?.[0];
        setProfile(userProfile);

        // Get their articles
        const articlesRes = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/articles/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'submitterId', values: [params.userId] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'status', values: ['published'] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'limit', values: [50] })),
          { headers: H, credentials: 'include' }
        );
        const articlesData = articlesRes.ok ? await articlesRes.json() : { documents: [] };
        setArticles(articlesData.documents || []);

        // Check if current user follows this profile
        if (authData?.$id) {
          const followRes = await fetch(
            ENDPOINT + '/databases/' + DB + '/collections/follows/documents?queries[]=' +
            encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followerId', values: [authData.$id] })) +
            '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followingId', values: [params.userId] })),
            { headers: H, credentials: 'include' }
          );
          const followData = followRes.ok ? await followRes.json() : { documents: [] };
          setIsFollowing(followData.documents.length > 0);
        }
      } catch (err) {
        console.error('Profile load error:', err);
      }
      setLoading(false);
    })();
  }, [params.userId]);

  const toggleFollow = async () => {
    if (!currentUser) {
      window.location.href = '/auth';
      return;
    }
    try {
      if (isFollowing) {
        // Unfollow — delete the follow record
        const followRes = await fetch(
          ENDPOINT + '/databases/' + DB + '/collections/follows/documents?queries[]=' +
          encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followerId', values: [currentUser.$id] })) +
          '&queries[]=' + encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'followingId', values: [params.userId] })),
          { headers: H, credentials: 'include' }
        );
        const followData = await followRes.json();
        const followId = followData.documents?.[0]?.$id;
        if (followId) {
          await fetch(ENDPOINT + '/databases/' + DB + '/collections/follows/documents/' + followId, {
            method: 'DELETE',
            headers: H,
            credentials: 'include',
          });
          setIsFollowing(false);
        }
      } else {
        // Follow
        await fetch(ENDPOINT + '/databases/' + DB + '/collections/follows/documents', {
          method: 'POST',
          headers: { ...H, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ data: { followerId: currentUser.$id, followingId: params.userId } }),
        });
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  if (!profile) return <div style={{ padding: '20px', textAlign: 'center' }}>User not found</div>;

  const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: isDarkMode ? '#0a0a0a' : '#fff', paddingBottom: '100px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        <Link href="/" style={{ color: '#c41e3a', textDecoration: 'none', fontSize: '14px', fontWeight: 700 }}>
          ← Back
        </Link>

        {/* Profile Header */}
        <div style={{ textAlign: 'center', padding: '30px 20px', borderBottom: '1px solid ' + (isDarkMode ? '#333' : '#eee'), marginBottom: '30px' }}>
          <div
            style={{
              width: '120px',
              height: '120px',
              margin: '0 auto 16px',
              borderRadius: '50%',
              backgroundColor: '#c41e3a',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              fontWeight: 800,
              overflow: 'hidden',
            }}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              (profile.displayName || 'U')[0].toUpperCase()
            )}
          </div>
          <h1 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 800, color: isDarkMode ? '#fff' : '#1a1a1a' }}>
            {profile.displayName || profile.userName}
          </h1>
          <p style={{ margin: '0 0 20px', color: isDarkMode ? '#aaa' : '#666', fontSize: '14px' }}>@{profile.userName}</p>
          {profile.bio && <p style={{ margin: '0 0 20px', color: isDarkMode ? '#ccc' : '#555', fontSize: '15px' }}>{profile.bio}</p>}

          <button
            onClick={toggleFollow}
            style={{
              background: isFollowing ? (isDarkMode ? '#333' : '#f0f0f0') : '#c41e3a',
              color: isFollowing ? (isDarkMode ? '#fff' : '#1a1a1a') : 'white',
              border: isFollowing ? ('1px solid ' + (isDarkMode ? '#555' : '#ddd')) : 'none',
              padding: '10px 28px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '40px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#c41e3a' }}>{articles.length}</div>
            <div style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#666', marginTop: '4px' }}>Articles</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#c41e3a' }}>{totalViews.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: isDarkMode ? '#aaa' : '#666', marginTop: '4px' }}>Total Views</div>
          </div>
        </div>

        {/* Articles Grid */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: isDarkMode ? '#fff' : '#1a1a1a', marginBottom: '20px' }}>
            Latest Articles
          </h2>
          {articles.length === 0 ? (
            <p style={{ textAlign: 'center', color: isDarkMode ? '#666' : '#aaa' }}>No articles yet</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {articles.map((article) => (
                <Link key={article.$id} href={'/article/' + article.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: isDarkMode ? '#1a1a1a' : '#f9f9f9', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}>
                    <div style={{ height: '160px', background: '#ddd', overflow: 'hidden' }}>
                      {article.imageUrl && <img src={article.imageUrl} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontSize: '13px', color: '#c41e3a', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                        {article.category}
                      </div>
                      <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: isDarkMode ? '#fff' : '#1a1a1a', lineHeight: 1.3 }}>
                        {article.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: '12px', color: isDarkMode ? '#999' : '#888' }}>
                        {article.views || 0} views
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
