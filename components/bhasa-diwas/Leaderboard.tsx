'use client';

const CAT_LABELS: Record<string, { emoji: string; nepali: string }> = {
  poetry: { emoji: '✍️', nepali: 'काव्य' },
  essay: { emoji: '📚', nepali: 'निबन्ध' },
  photo: { emoji: '📷', nepali: 'फोटो' }
};

const MEDALS = ['🏆', '🥈', '🥉'];
const BORDER = ['#facc15', '#9ca3af', '#fb923c'];
const BG = ['#fefce8', '#f9fafb', '#fff7ed'];

const S = {
  wrapper: { background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' },
  header: { background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)', color: 'white', padding: '20px' },
  headerTitle: { fontSize: '22px', fontWeight: 700, margin: 0 },
  headerSub: { fontSize: '13px', opacity: 0.9, margin: '4px 0 0' },
  emptyRow: { padding: '24px', textAlign: 'center' as const, color: '#9ca3af' },
  rowContent: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  medal: { fontSize: '32px', marginRight: '12px' },
  itemTitle: { fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 4px' },
  itemSub: { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' },
  itemDesc: { fontSize: '12px', color: '#9ca3af', margin: 0 },
  votesNum: { fontSize: '22px', fontWeight: 700, color: '#b91c1c' },
  votesLabel: { fontSize: '11px', color: '#9ca3af' }
};

function rowStyle(idx: number) {
  return { padding: '20px', borderLeft: `4px solid ${BORDER[idx]}`, background: BG[idx], borderBottom: '1px solid #f3f4f6' };
}

export default function Leaderboard({ category, leaderboard }: { category: 'poetry' | 'essay' | 'photo'; leaderboard: any[] }) {
  const categoryInfo = CAT_LABELS[category];

  return (
    <div style={S.wrapper}>
      <div style={S.header}>
        <h2 style={S.headerTitle}>{categoryInfo.emoji} {categoryInfo.nepali}</h2>
        <p style={S.headerSub}>शीर्ष तीन रचना</p>
      </div>
      <div>
        {leaderboard.length === 0 ? (
          <div style={S.emptyRow}>अहिले कुनै रचना छैन</div>
        ) : (
          leaderboard.map((item, index) => (
            <div key={item.$id} style={rowStyle(index)}>
              <div style={S.rowContent}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={S.medal}>{MEDALS[index]}</div>
                  <div>
                    <h3 style={S.itemTitle}>{item.title}</h3>
                    <p style={S.itemSub}>{item.submitterName}</p>
                    <p style={S.itemDesc}>{item.description ? item.description.slice(0, 80) : ''}...</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={S.votesNum}>{item.votes || 0}</div>
                  <div style={S.votesLabel}>मत</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
