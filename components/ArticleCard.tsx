'use client';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.in/v1';
const PROJECT = 'khabardarjeeling';
const BUCKET = 'article-image';

function getImageUrl(a: any): string {
  const id = a.imageFileId || a.imageUrl;
  if (!id || ['Text','null','undefined',''].includes(String(id))) return '';
  if (String(id).startsWith('http')) return id;
  return `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
}

function getInitials(name: string): string {
  if (!name) return 'KD';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

function fmtDate(s: string): string {
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

interface ArticleCardProps {
  id: string;
  title: string;
  summary?: string;
  authorName?: string;
  submitterName?: string;
  submitterAvatar?: string;
  category?: string;
  imageFileId?: string;
  imageUrl?: string;
  youtube_id?: string;
  publishedAt?: string;
  createdAt?: string;
  views?: number;
  isDarkMode?: boolean;
}

export default function ArticleCard({ id, title, summary, authorName, submitterName, submitterAvatar, category, imageFileId, imageUrl, youtube_id, publishedAt, createdAt, views, isDarkMode }: ArticleCardProps) {
  const displayName = submitterName || authorName || 'Staff Reporter';
  const imgUrl = youtube_id
    ? `https://img.youtube.com/vi/${youtube_id}/maxresdefault.jpg`
    : getImageUrl({ imageFileId, imageUrl });
  const hasVideo = !!youtube_id;
  const date = publishedAt || createdAt || '';

  return (
    <Link href={`/article/${id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ backgroundColor: isDarkMode ? '#2a2a2a' : 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: isDarkMode ? '0 4px 12px rgba(255,255,255,0.1)' : '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.3s ease, box-shadow 0.3s ease', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = isDarkMode ? '0 12px 24px rgba(255,255,255,0.15)' : '0 12px 24px rgba(0,0,0,0.15)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = isDarkMode ? '0 4px 12px rgba(255,255,255,0.1)' : '0 4px 12px rgba(0,0,0,0.1)'; }}>
        
        <div style={{ position: 'relative', width: '100%', height: '200px', backgroundColor: '#e0e0e0', overflow: 'hidden' }}>
          {imgUrl ? (
            <img src={imgUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: '#c41e3a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px' }}>No Image</div>
          )}
          {hasVideo && (
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 0, height: 0, borderLeft: '16px solid #c41e3a', borderTop: '10px solid transparent', borderBottom: '10px solid transparent', marginLeft: '4px' }} />
              </div>
              <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(196,30,58,0.95)', color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>VIDEO</div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {category && (
            <div style={{ display: 'inline-block', backgroundColor: '#f5c518', color: '#c41e3a', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', marginBottom: '10px', width: 'fit-content' }}>
              {category}
            </div>
          )}
          <h3 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: '700', color: isDarkMode ? '#fff' : '#c41e3a', lineHeight: '1.4', flex: 1 }}>
            {title}
          </h3>
          {summary && (
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: isDarkMode ? '#bbb' : '#666', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {summary}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto', paddingTop: '12px', borderTop: `1px solid ${isDarkMode ? '#444' : '#f0f0f0'}` }}>
            {(submitterAvatar && submitterAvatar !== 'null') ? (
              <img src={submitterAvatar} alt={displayName} style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#c41e3a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                {getInitials(displayName)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: isDarkMode ? '#ddd' : '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: isDarkMode ? '#999' : '#aaa' }}>
                {date && <span>{fmtDate(date)}</span>}
                {views !== undefined && views > 0 && <span>👁 {views.toLocaleString()}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

