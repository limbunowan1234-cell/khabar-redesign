'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { getWorkerAuthToken } from '@/lib/appwrite';
// Certificate download is disabled for now -- see MyWinBanner below --
// until the real template art (coming tomorrow) replaces the interim
// code-drawn design in lib/certGenerator.ts.

// Week 40 of the Cloudflare migration (see cloudflare/README.md): photo
// submissions read from R2 through the Worker now.
const WORKER_URL = 'https://khabar-worker.limbunowan1234.workers.dev';

const CATS: Record<string, { emoji: string; nepali: string; color: string }> = {
  poetry: { emoji: '✍️', nepali: 'काव्य', color: 'linear-gradient(135deg, #9333ea, #6b21a8)' },
  essay: { emoji: '📚', nepali: 'निबन्ध', color: 'linear-gradient(135deg, #2563eb, #1e3a8a)' },
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
  closingBox: { background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)', color: 'white', borderRadius: '8px', padding: '40px', textAlign: 'center' as const },
  winnerBanner: { background: 'linear-gradient(135deg, #facc15, #f59e0b)', color: '#1f2937', borderRadius: '10px', padding: '28px', marginBottom: '32px' },
  bannerTitle: { fontSize: '22px', fontWeight: 800, margin: '0 0 6px' },
  bannerText: { fontSize: '14px', margin: '0 0 16px', opacity: 0.9 },
  formRow: { display: 'flex', flexDirection: 'column' as const, gap: '4px', marginBottom: '12px' },
  label: { fontSize: '13px', fontWeight: 700 },
  input: { padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.2)', fontSize: '14px', fontFamily: 'inherit' },
  btnRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' as const, marginTop: '8px' },
  primaryBtn: { background: '#1f2937', color: 'white', border: 'none', padding: '10px 22px', borderRadius: '20px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' },
  secondaryBtn: { background: 'white', color: '#1f2937', border: '2px solid #1f2937', padding: '9px 20px', borderRadius: '20px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' },
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

// One entry the logged-in user won -- surfaced above the gallery so they
// don't have to hunt for their own name in the grid below.
function MyWinBanner({ entry, onAddressSaved }: { entry: any; onAddressSaved: (id: string) => void }) {
  const [fullName, setFullName] = useState(entry.submitterName || '');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmitAddress() {
    if (!fullName.trim() || !address.trim() || !phone.trim()) {
      setError('कृपया सबै फिल्डहरू भर्नुहोस्।');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const token = await getWorkerAuthToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(WORKER_URL + '/bhasa-diwas/submissions/' + encodeURIComponent(entry.$id) + '/winner-address', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, address, phone }),
      });
      if (!res.ok) throw new Error('Failed');
      onAddressSaved(entry.$id);
    } catch {
      setError('ठेगाना पठाउन असफल भयो, फेरि प्रयास गर्नुहोस्।');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={S.winnerBanner}>
      <h3 style={S.bannerTitle}>{MEDALS[(entry.winnerRank || 1) - 1]} बधाई छ! तपाईं {CATS[entry.category]?.nepali || entry.category} मा {MEDAL_LABELS[(entry.winnerRank || 1) - 1]} भएको छ!</h3>
      <p style={S.bannerText}>
        स्मृति चिन्ह पठाउन आफ्नो ठेगाना तल पेस गर्नुहोस्। प्रमाणपत्र चाँडै उपलब्ध हुनेछ।
      </p>

      {entry.addressSubmitted ? (
        <p style={{ fontWeight: 700, fontSize: '14px' }}>✅ ठेगाना प्राप्त भयो, स्मृति चिन्ह चाँडै पठाइनेछ।</p>
      ) : (
        <>
          <div style={S.formRow}>
            <label style={S.label}>पूरा नाम</label>
            <input style={S.input} value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div style={S.formRow}>
            <label style={S.label}>पूरा ठेगाना</label>
            <input style={S.input} value={address} onChange={e => setAddress(e.target.value)} placeholder="घर/सडक, क्षेत्र, सहर, जिल्ला, पिन कोड" />
          </div>
          <div style={S.formRow}>
            <label style={S.label}>फोन नम्बर</label>
            <input style={S.input} value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          {error && <p style={{ color: '#7f1d1d', fontSize: '13px', fontWeight: 700 }}>{error}</p>}
          <div style={S.btnRow}>
            <button style={S.primaryBtn} disabled={saving} onClick={handleSubmitAddress}>
              {saving ? 'पठाउँदै...' : 'ठेगाना पठाउनुहोस्'}
            </button>
          </div>
        </>
      )}
      <div style={S.btnRow}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 20px', borderRadius: '20px', fontWeight: 700, fontSize: '14px', color: '#1f2937', border: '2px dashed rgba(31,41,55,0.4)' }}>
          🎓 प्रमाणपत्र चाँडै आउँदैछ
        </span>
      </div>
    </div>
  );
}

export default function WinnersGallery() {
  const [winners, setWinners] = useState<any>({});
  const [myWins, setMyWins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchWinners = async () => {
      try {
        // Finalized top-3 (see cloudflare/src/routes/bhasaDiwas.ts
        // POST /finalize-winners), not the live leaderboard -- results
        // only appear here once an admin has locked them in.
        const res = await fetch('/api/bhasa-diwas/winners');
        const data = await res.json();
        const docs: any[] = data.documents || [];
        const byCategory: Record<string, any[]> = {};
        for (const doc of docs) {
          if (!byCategory[doc.category]) byCategory[doc.category] = [];
          byCategory[doc.category].push(doc);
        }
        setWinners(byCategory);
        if (user) setMyWins(docs.filter(d => d.submitterId === user.$id));
      } catch (error) {
        console.error('Failed to fetch winners:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWinners();
  }, [user]);

  function markAddressSaved(id: string) {
    setMyWins(prev => prev.map(w => w.$id === id ? { ...w, addressSubmitted: true } : w));
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px' }}>लोड हो रहेको छ...</div>;

  return (
    <div>
      <div style={S.headerWrap}>
        <h2 style={S.headerTitle}>नेपाली भाषा दिवस विजेता</h2>
        <p style={S.headerSub}>अगस्ट ३०, २०२६</p>
      </div>

      {myWins.map(entry => (
        <MyWinBanner key={entry.$id} entry={entry} onAddressSaved={markAddressSaved} />
      ))}

      {Object.entries(CATS).map(([category, cat]) => (
        <div key={category} style={{ marginBottom: '48px' }}>
          <div style={categoryHeaderStyle(cat.color)}>
            <h3 style={S.categoryTitle}>{cat.emoji} {cat.nepali}</h3>
          </div>
          <div style={S.cardsGrid}>
            {winners[category] && winners[category].length > 0 ? (
              winners[category].map((winner: any) => (
                <Link key={winner.$id} href={'/nepali-bhasa-diwas/' + winner.$id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={winnerCardStyle(BORDER[(winner.winnerRank || 1) - 1])}>
                  <div style={medalHeaderStyle(cat.color)}>
                    <div style={S.medalEmoji}>{MEDALS[(winner.winnerRank || 1) - 1]}</div>
                    <div style={S.medalLabel}>{MEDAL_LABELS[(winner.winnerRank || 1) - 1]}</div>
                  </div>
                  <div style={S.cardBody}>
                    <h4 style={S.cardTitle}>{winner.title}</h4>
                    <p style={S.cardSub}>{winner.submitterName}</p>
                    <p style={S.cardDesc}>{winner.description ? winner.description.slice(0, 100) : ''}...</p>
                    <div style={S.cardFooter}>
                      <span style={{ color: '#b91c1c', fontWeight: 700 }}>👍 {winner.votes || 0} मत</span>
                    </div>
                  </div>
                </div>
                </Link>
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
