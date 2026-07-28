'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const CATS: Record<string, { emoji: string; nepali: string; color: string }> = {
  poetry: { emoji: '🎭', nepali: 'काव्य', color: 'linear-gradient(135deg, #9333ea, #6b21a8)' },
  essay: { emoji: '📚', nepali: 'निबन्ध', color: 'linear-gradient(135deg, #2563eb, #1e3a8a)' },
  photo: { emoji: '📷', nepali: 'फोटो', color: 'linear-gradient(135deg, #16a34a, #14532d)' }
};

const MEDALS = ['🏆', '🥈', '🥉'];
const MEDAL_LABELS = ['प्रथम', 'दोस्रो', 'तेस्रो'];
const BORDER = ['#facc15', '#9ca3af', '#fb923c'];

const S = {
  headerWrap: { textAlign: 'center' as const, marginBottom: '48px' },
  headerTitle: { fontSize: '32px', fontWeight: 700, color: '#b91c1c', margin: '0 0 8px' },
  headerSub: { color: '#6b7280' },
  categoryTitle: { fontSize: '26px', fontWeight: 700, margin: 0 },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '48px' },
  medalEmoji: { fontSize: '40px', marginBottom: '8px' },
  medalLabel: { fontSize: '20px', fontWeight: 700 },
  cardBody: { padding: '20px', background: 'white' },
  cardTitle: { fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 8px' },
  cardSub: { color: '#6b7280', marginBottom: '12px' },
  cardDesc: { fontSize: '13px', color: '#374151', marginBottom: '12px' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', paddingTop: '12px' },
  closingBox: { background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)', color: 'white', borderRadius: '8px', padding: '40px', textAlign: 'center' as const }
};

function categoryHeaderStyle(color: string) {
  return { background: color, color: 'white', padding: '24px', borderRadius: '8px 8px 0 0' };
}
function winnerCardStyle(borderColor: string) {
  return { borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: `4px solid ${borderColor}` };
}
function medalHeaderStyle(color: string) {
  return { background: color, color: 'white', padding: '20px', textAlign: 'center' as const };
}

export default function WinnersGallery() {
  const [winners, setWinners] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWinners = async () => {
      try {
        const res = await fetch('/api/bhasa-diwas/vote');
        const data = await res.json();
        setWinners(data);
      } catch (error) {
        console.error('Failed to fetch winners:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWinners();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '48px' }}>लोड हो रहेको छ...</div>;

  return (
    <div>
      <div style={S.headerWrap}>
        <h2 style={S.headerTitle}>नेपाली भाषा दिवस विजेता</h2>
        <p style={S.headerSub}>अगस्ट २०, २०२६</p>
      </div>

      {Object.entries(CATS).map(([category, cat]) => (
        <div key={category} style={{ marginBottom: '48px' }}>
          <div style={categoryHeaderStyle(cat.color)}>
            <h3 style={S.categoryTitle}>{cat.emoji} {cat.nepali}</h3>
          </div>
          <div style={S.cardsGrid}>
            {winners[category] && winners[category].length > 0 ? (
              winners[category].map((winner: any, index: number) => (
                <div key={winner.$id} style={winnerCardStyle(BORDER[index])}>
                  <div style={medalHeaderStyle(cat.color)}>
                    <div style={S.medalEmoji}>{MEDALS[index]}</div>
                    <div style={S.medalLabel}>{MEDAL_LABELS[index]}</div>
                  </div>
                  {category === 'photo' && winner.imageFileId && (
                    <div style={{ height: '180px', background: '#e5e7eb' }}>
                      <Image src={`/api/image-proxy?fileId=${winner.imageFileId}&bucket=6a67a307002f71e8dcf5`} alt={winner.title} width={400} height={300} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div style={S.cardBody}>
                    <h4 style={S.cardTitle}>{winner.title}</h4>
                    <p style={S.cardSub}>{winner.submitterName}</p>
                    <p style={S.cardDesc}>{winner.description ? winner.description.slice(0, 100) : ''}...</p>
                    <div style={S.cardFooter}>
                      <span style={{ color: '#b91c1c', fontWeight: 700 }}>👍 {winner.votes || 0} मत</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px', color: '#9ca3af' }}>अहिले कुनै विजेता छैन</div>
            )}
          </div>
        </div>
      ))}

      <div style={S.closingBox}>
        <h3 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>सबैलाई धन्यवाद!</h3>
        <p style={{ opacity: 0.9 }}>नेपाली भाषा दिवसमा आपनो भाग लिएकोको लागि धन्यवाद।</p>
      </div>
    </div>
  );
}