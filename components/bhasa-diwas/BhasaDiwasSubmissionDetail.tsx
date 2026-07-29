'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import SiteFooter from '@/components/SiteFooter';

const CATEGORY_LABELS: Record<string, string> = {
  poetry: 'काव्य',
  essay: 'निबन्ध',
  photo: 'फोटो'
};

const S = {
  page: { minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: {
    background: '#b91c1c', color: 'white', padding: '14px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky' as const, top: 0, zIndex: 100
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoBadge: { width: '40px', height: '40px', borderRadius: '50%', background: 'white', overflow: 'hidden' },
  headerTitle: { fontSize: '18px', fontWeight: 700, color: 'white', textDecoration: 'none' },
  backBtn: { background: 'white', color: '#b91c1c', padding: '8px 18px', borderRadius: '20px', fontWeight: 600, textDecoration: 'none', fontSize: '13px' },
  container: { maxWidth: '700px', margin: '0 auto', padding: '40px 20px' },
  categoryPill: { display: 'inline-block', background: '#fef2f2', color: '#b91c1c', padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, marginBottom: '20px' },
  meta: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', color: '#6b7280', fontSize: '14px' },
  avatar: { width: '36px', height: '36px', borderRadius: '50%', background: '#b91c1c', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 },
  voteRow: { display: 'flex', alignItems: 'center', gap: '20px', margin: '32px 0', paddingTop: '24px', borderTop: '1px solid #e5e7eb' },
  commentsSection: { marginTop: '48px', paddingTop: '32px', borderTop: '1px solid #e5e7eb' },
  commentsTitle: { fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '20px' },
  commentBox: { width: '100%', padding: '12px 16px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', minHeight: '80px', marginBottom: '12px', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  commentSubmitBtn: { background: '#b91c1c', color: 'white', padding: '10px 24px', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '14px' },
  commentItem: { padding: '16px 0', borderBottom: '1px solid #f3f4f6' },
  commentAuthor: { fontWeight: 700, color: '#111827', fontSize: '14px', marginBottom: '4px' },
  commentText: { color: '#374151', fontSize: '14px', lineHeight: 1.6 },
  commentDate: { fontSize: '12px', color: '#9ca3af', marginTop: '4px' }
};

function voteBtnStyle(voted: boolean) {
  return {
    background: voted ? '#fef2f2' : 'white', border: '2px solid #b91c1c', color: '#b91c1c',
    padding: '10px 24px', borderRadius: '24px', fontWeight: 700, cursor: voted ? 'default' : 'pointer', fontSize: '15px'
  };
}

function PoetryContent({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '32px', fontFamily: 'Georgia, serif' }}>{title}</h1>
      <div style={{
        fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '18px', lineHeight: 2.2,
        color: '#1f2937', whiteSpace: 'pre-wrap', maxWidth: '480px', margin: '0 auto'
      }}>
        {description}
      </div>
    </div>
  );
}

function EssayContent({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 style={{ fontSize: '30px', fontWeight: 700, color: '#111827', marginBottom: '24px', fontFamily: 'Georgia, serif' }}>{title}</h1>
      <div style={{ fontSize: '17px', lineHeight: 1.9, color: '#1f2937', textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
        {description}
      </div>
    </div>
  );
}

function PhotoContent({ title, description, imageFileId }: { title: string; description: string; imageFileId: string | null }) {
  return (
    <div>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#111827', marginBottom: '20px' }}>{title}</h1>
      {imageFileId && (
        <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', background: '#e5e7eb' }}>
          <img
            src={'/api/image-proxy?fileId=' + imageFileId + '&bucket=6a67a307002f71e8dcf5'}
            alt={title}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      )}
      <p style={{ fontSize: '16px', lineHeight: 1.7, color: '#374151' }}>{description}</p>
    </div>
  );
}

export default function BhasaDiwasSubmissionDetail({ id }: { id: string }) {
  const { user, isAuthenticated } = useAuthStore();
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/bhasa-diwas/submissions');
        const data = await res.json();
        const found = (data.submissions || []).find((s: any) => s.$id === id);
        setSubmission(found || null);
        if (found && user && user.$id) {
          setHasVoted((data.userVotes || []).includes(found.$id));
        }

        const commentsRes = await fetch('/api/bhasa-diwas/comments?submissionId=' + id);
        const commentsData = await commentsRes.json();
        setComments(commentsData.comments || []);
      } catch (error) {
        console.error('Failed to fetch submission:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, user]);

  const handleVote = async () => {
    if (!isAuthenticated || !user) {
      alert('कृपया मत दिन लगिन गर्नुहोस्।');
      return;
    }
    try {
      const res = await fetch('/api/bhasa-diwas/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: id, userId: user.$id })
      });
      const data = await res.json();
      if (data.success) {
        setHasVoted(true);
        setSubmission((prev: any) => ({ ...prev, votes: (prev.votes || 0) + 1 }));
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Vote failed:', error);
    }
  };

  const handleCommentSubmit = async () => {
    if (!isAuthenticated || !user) {
      alert('कृपया टिप्पणी गर्न लगिन गर्नुहोस्।');
      return;
    }
    if (!commentText.trim()) return;

    setPostingComment(true);
    try {
      const res = await fetch('/api/bhasa-diwas/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: id,
          userId: user.$id,
          userName: user.name || 'Anonymous',
          text: commentText
        })
      });
      const data = await res.json();
      if (data.success) {
        setComments(prev => [data.comment, ...prev]);
        setCommentText('');
      }
    } catch (error) {
      console.error('Comment failed:', error);
    } finally {
      setPostingComment(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '80px' }}>लोड हो रहेको छ...</div>;
  }

  if (!submission) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <div style={S.headerLeft}>
            <Link href="/nepali-bhasa-diwas" style={S.headerTitle}>Khabar Darjeeling</Link>
          </div>
          <Link href="/nepali-bhasa-diwas" style={S.backBtn}>फिर्ता</Link>
        </div>
        <div style={{ textAlign: 'center', padding: '80px' }}>रचना फेला परेन</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logoBadge}>
            <img src="/assets/logo.png" alt="Khabar Darjeeling" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <Link href="/nepali-bhasa-diwas" style={S.headerTitle}>Khabar Darjeeling</Link>
        </div>
        <Link href="/nepali-bhasa-diwas" style={S.backBtn}>फिर्ता</Link>
      </div>

      <div style={S.container}>
        <div style={S.categoryPill}>{CATEGORY_LABELS[submission.category] || submission.category}</div>

        <div style={S.meta}>
          <div style={S.avatar}>{submission.submitterName.charAt(0).toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 600, color: '#111827' }}>{submission.submitterName}</div>
            <div>{new Date(submission.$createdAt).toLocaleDateString('ne-NP')}</div>
          </div>
        </div>

        {submission.category === 'poetry' && (
          <PoetryContent title={submission.title} description={submission.description} />
        )}
        {submission.category === 'essay' && (
          <EssayContent title={submission.title} description={submission.description} />
        )}
        {submission.category === 'photo' && (
          <PhotoContent title={submission.title} description={submission.description} imageFileId={submission.imageFileId} />
        )}

        <div style={S.voteRow}>
          <button onClick={handleVote} disabled={hasVoted} style={voteBtnStyle(hasVoted)}>
            👍 {submission.votes || 0} मत
          </button>
        </div>

        <div style={S.commentsSection}>
          <h2 style={S.commentsTitle}>टिप्पणीहरू</h2>

          {isAuthenticated ? (
            <div style={{ marginBottom: '24px' }}>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="तपाईंको विचार लेख्नुहोस्..."
                style={S.commentBox}
              />
              <button onClick={handleCommentSubmit} disabled={postingComment} style={S.commentSubmitBtn}>
                {postingComment ? 'पठाइँदैछ...' : 'टिप्पणी गर्नुहोस्'}
              </button>
            </div>
          ) : (
            <p style={{ color: '#6b7280', marginBottom: '24px' }}>टिप्पणी गर्न लगिन गर्नुहोस्।</p>
          )}

          {comments.length === 0 ? (
            <p style={{ color: '#9ca3af' }}>अहिले कुनै टिप्पणी छैन।</p>
          ) : (
            comments.map((c: any) => (
              <div key={c.$id} style={S.commentItem}>
                <div style={S.commentAuthor}>{c.userName}</div>
                <div style={S.commentText}>{c.text}</div>
                <div style={S.commentDate}>{new Date(c.$createdAt).toLocaleDateString('ne-NP')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
