'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { computeContestRankings, RankedEntry } from '@/lib/certRanking';

const PRIZES: Record<number, string> = { 1: '₹5,000', 2: '₹3,000', 3: '₹2,000' };
const PODIUM: Record<number, { medal: string; color: string; height: string }> = {
  1: { medal: '🥇', color: '#f5c518', height: '150px' },
  2: { medal: '🥈', color: '#c0c0c0', height: '120px' },
  3: { medal: '🥉', color: '#cd7f32', height: '100px' },
};

function getInitials(name: string): string {
  if (!name) return 'KD';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function ContestResultsBanner({ isDarkMode }: { isDarkMode?: boolean }) {
  const [top3, setTop3] = useState<RankedEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    computeContestRankings()
      .then((rankings) => { if (!cancelled) setTop3(rankings.slice(0, 3)); })
      .catch(() => { if (!cancelled) setTop3([]); });
    return () => { cancelled = true; };
  }, []);

  if (!top3 || top3.length === 0) return null;

  // Podium display order: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);

  return (
    <div style={{
      background: 'linear-gradient(135deg, #c41e3a, #a01830)',
      borderRadius: '16px',
      padding: '28px 20px',
      marginBottom: '24px',
      boxShadow: '0 6px 24px rgba(196,30,58,0.3)',
      color: 'white',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', color: '#f5c518', marginBottom: '6px' }}>🎉 Announcement</div>
      <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px' }}>Story Contest 2026 — Results Are In!</h2>
      <p style={{ fontSize: '13px', opacity: 0.9, margin: '0 0 24px' }}>Congratulations to our winners, and thank you to everyone who took part.</p>

      {/* PODIUM */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '12px', maxWidth: '520px', margin: '0 auto 24px', flexWrap: 'wrap' }}>
        {order.map((entry) => {
          const p = PODIUM[entry.rank];
          return (
            <Link key={entry.articleId} href={'/article/' + entry.articleId} style={{ textDecoration: 'none', color: 'inherit', flex: '1 1 140px', maxWidth: '160px' }}>
              <div style={{ fontSize: '32px', marginBottom: '6px' }}>{p.medal}</div>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', border: '2px solid ' + p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', margin: '0 auto 8px' }}>
                {getInitials(entry.submitterName)}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', lineHeight: '1.3', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{entry.submitterName}</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: p.color, marginBottom: '10px' }}>{PRIZES[entry.rank]}</div>
              <div style={{ height: p.height, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '8px 8px 0 0', borderTop: '3px solid ' + p.color, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10px' }}>
                <span style={{ fontSize: '22px', fontWeight: '800', opacity: 0.5 }}>#{entry.rank}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '14px 18px', fontSize: '13px', lineHeight: '1.6', maxWidth: '560px', margin: '0 auto 18px' }}>
        🎓 Every participant will receive an official <strong>E-Certificate</strong> on their profile — winners get their placement certificate, everyone else gets a participation certificate. All done wonderfully!
      </div>

      <Link href="/profile" style={{ textDecoration: 'none' }}>
        <button style={{ backgroundColor: '#f5c518', color: '#1a1a1a', border: 'none', padding: '12px 28px', borderRadius: '30px', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
          👤 My Profile — Check Your Prize & Certificate
        </button>
      </Link>
    </div>
  );
}
