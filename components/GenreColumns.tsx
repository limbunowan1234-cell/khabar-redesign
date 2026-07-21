'use client';
import Link from 'next/link';

const ENDPOINT = 'https://api.khabardarjeeling.space/v1';
const PROJECT = 'khabardarjeeling';

const SECTION_GENRES = ['Politics', 'Voice of People', 'Culture', 'Tourism', 'Editorial', 'Sports'];

const GENRE_ALIASES: { [key: string]: string[] } = {
  'voice of people': ['voice of people', 'citizen journalism'],
  'editorial': ['editorial', 'opinion']
};

const GENRE_COLORS: { [key: string]: string } = {
  'Politics': '#c41e3a',
  'Voice of People': '#0F4C5C',
  'Culture': '#b8860b',
  'Tourism': '#00695c',
  'Editorial': '#7b1fa2',
  'Sports': '#2e7d32',
  'Health': '#d32f2f',
  'Education': '#0097a7',
  'Technology': '#455a64',
  'Poetry': '#8e5b3a'
};

function imgOf(a: any): string {
  if (a?.youtube_id) return 'https://img.youtube.com/vi/' + a.youtube_id + '/maxresdefault.jpg';
  if (!a?.imageFileId) return '';
  return ENDPOINT + '/storage/buckets/article-image/files/' + a.imageFileId + '/preview?width=600&quality=70&project=' + PROJECT;
}

function genreOf(a: any): string {
  return (a?.genre || a?.category || '').toLowerCase();
}

export default function GenreColumns({ articles, isDarkMode, onSelectGenre }: {
  articles: any[];
  isDarkMode?: boolean;
  onSelectGenre: (g: string) => void;
}) {
  const cardBg = isDarkMode ? '#1e1e1e' : '#ffffff';
  const textCol = isDarkMode ? '#fff' : '#1a1a1a';
  const subCol = isDarkMode ? '#999' : '#888';
  const divCol = isDarkMode ? '#2a2a2a' : '#f0f0f0';

  const sections = SECTION_GENRES.map((g) => {
    const match = GENRE_ALIASES[g.toLowerCase()] || [g.toLowerCase()];
    const items = articles.filter((a: any) => match.includes(genreOf(a)));
    return { genre: g, items };
  }).filter((s) => s.items.length >= 3).slice(0, 4);

  if (sections.length === 0) return null;

  return (
    <div style={{ marginBottom: '28px' }}>
      <style>{`
        .gcol-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 900px) { .gcol-grid { grid-template-columns: 1fr; } }
        .gcol-lead img { transition: transform 0.45s ease; }
        .gcol-lead:hover img { transform: scale(1.05); }
        .gcol-item:hover h4 { color: #c41e3a !important; }
      `}</style>

      <div className="gcol-grid">
        {sections.map(({ genre, items }) => {
          const color = GENRE_COLORS[genre] || '#c41e3a';
          const lead = items[0];
          const rest = items.slice(1, 5);
          const leadImg = imgOf(lead);
          const leadAuthor = lead.submitterName || lead.authorName || 'Staff Reporter';

          return (
            <div key={genre} style={{ backgroundColor: cardBg, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 3px 14px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '3px solid ' + color }}>
                <span style={{ width: '5px', height: '18px', backgroundColor: color, borderRadius: '3px' }} />
                <h2 style={{ fontSize: '14px', fontWeight: 900, color: textCol, textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>{genre}</h2>
                <button onClick={() => onSelectGenre(genre)} style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 800, color: color, background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: 'inherit' }}>View All &rarr;</button>
              </div>

              <Link href={'/article/' + (lead.slug || lead.$id)} style={{ textDecoration: 'none' }}>
                <div className="gcol-lead" style={{ position: 'relative', height: '190px', overflow: 'hidden', backgroundColor: '#1a1a1a', cursor: 'pointer' }}>
                  {leadImg ? (
                    <img loading="lazy" src={leadImg} alt={lead.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,' + color + ', #1a1a1a)' }} />
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.8) 100%)' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.3, margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.5)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{lead.title}</h3>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', margin: '5px 0 0', fontWeight: 600 }}>By {leadAuthor}</p>
                  </div>
                </div>
              </Link>

              <div style={{ padding: '6px 18px 12px' }}>
                {rest.map((a: any, i: number) => {
                  const author = a.submitterName || a.authorName || 'Staff Reporter';
                  return (
                    <Link key={a.$id} href={'/article/' + (a.slug || a.$id)} style={{ textDecoration: 'none' }}>
                      <div className="gcol-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '11px 0', borderBottom: i < rest.length - 1 ? '1px solid ' + divCol : 'none', cursor: 'pointer' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, flexShrink: 0, marginTop: '7px' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: textCol, lineHeight: 1.4, margin: 0, transition: 'color 0.15s', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.title}</h4>
                          <p style={{ fontSize: '11px', color: subCol, margin: '3px 0 0', fontWeight: 600 }}>By {author}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
