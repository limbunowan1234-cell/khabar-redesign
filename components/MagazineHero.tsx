'use client';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';

function imgOf(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  if (!a?.imageFileId) return '';
  return ENDPOINT + '/storage/buckets/article-image/files/' + a.imageFileId + '/preview?width=1200&quality=70&project=' + PROJECT;
}

function genreOf(a: any): string {
  return a?.genre || a?.category || 'News';
}

export default function MagazineHero({ articles, isDarkMode }: { articles: any[]; isDarkMode?: boolean }) {
  const featured = articles.filter((a: any) => a.isFeatured);
  const pool = featured.length >= 4 ? featured : [...featured, ...articles.filter((a: any) => !a.isFeatured)];
  const main = pool[0];
  const side = pool.slice(1, 4);
  if (!main) return null;

  const mainImg = imgOf(main);
  const mainAuthor = main.submitterName || main.authorName || 'Staff Reporter';
  const cardBg = isDarkMode ? '#1e1e1e' : '#ffffff';
  const textCol = isDarkMode ? '#fff' : '#1a1a1a';
  const subCol = isDarkMode ? '#999' : '#888';

  return (
    <div style={{ marginBottom: '28px' }}>
      <style>{`
        .mag-hero-grid { display: grid; grid-template-columns: 1.9fr 1fr; gap: 16px; }
        .mag-hero-main { height: 440px; }
        .mag-side-img { height: 150px; }
        @media (max-width: 900px) {
          .mag-hero-grid { grid-template-columns: 1fr; }
          .mag-hero-main { height: 300px; }
        }
        .mag-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .mag-card:hover { transform: translateY(-3px); box-shadow: 0 12px 36px rgba(0,0,0,0.22) !important; }
        .mag-card img { transition: transform 0.5s ease; }
        .mag-card:hover img { transform: scale(1.05); }
      `}</style>

      <div className="mag-hero-grid">
        <Link href={'/article/' + (main.slug || main.$id)} style={{ textDecoration: 'none' }}>
          <div className="mag-card mag-hero-main" style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', backgroundColor: '#1a1a1a', boxShadow: '0 6px 24px rgba(0,0,0,0.15)' }}>
            {mainImg ? (
              <img loading="lazy" src={mainImg} alt={main.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #c41e3a 0%, #7a1020 100%)' }} />
            )}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.85) 100%)' }} />
            <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px' }}>
              <span style={{ backgroundColor: '#c41e3a', color: '#fff', padding: '5px 13px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{genreOf(main)}</span>
              {main.isBreaking && <span style={{ backgroundColor: '#f5c518', color: '#1a1a1a', padding: '5px 13px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Breaking</span>}
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '28px 26px 22px' }}>
              <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 900, color: '#fff', lineHeight: 1.2, margin: '0 0 10px', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>{main.title}</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 600 }}>By {mainAuthor}</p>
            </div>
          </div>
        </Link>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {side.map((a: any, i: number) => {
            const img = imgOf(a);
            const author = a.submitterName || a.authorName || 'Staff Reporter';
            if (i === 0) {
              return (
                <Link key={a.$id} href={'/article/' + (a.slug || a.$id)} style={{ textDecoration: 'none' }}>
                  <div className="mag-card" style={{ borderRadius: '12px', overflow: 'hidden', backgroundColor: cardBg, boxShadow: '0 3px 14px rgba(0,0,0,0.1)' }}>
                    <div className="mag-side-img" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
                      {img ? (
                        <img loading="lazy" src={img} alt={a.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #c41e3a, #1a1a1a)' }} />
                      )}
                      <span style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: '#c41e3a', color: '#fff', padding: '3px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }}>{genreOf(a)}</span>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 800, color: textCol, lineHeight: 1.35, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</h3>
                      <p style={{ fontSize: '11px', color: subCol, margin: '6px 0 0', fontWeight: 600 }}>By {author}</p>
                    </div>
                  </div>
                </Link>
              );
            }
            return (
              <Link key={a.$id} href={'/article/' + (a.slug || a.$id)} style={{ textDecoration: 'none' }}>
                <div className="mag-card" style={{ display: 'flex', gap: '12px', borderRadius: '12px', overflow: 'hidden', backgroundColor: cardBg, boxShadow: '0 3px 14px rgba(0,0,0,0.1)', padding: '10px' }}>
                  <div style={{ width: '86px', height: '68px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#1a1a1a', position: 'relative' }}>
                    {img ? (
                      <img loading="lazy" src={img} alt={a.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #c41e3a, #1a1a1a)' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#c41e3a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{genreOf(a)}</span>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: textCol, lineHeight: 1.35, margin: '3px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</h3>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
