'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { computeContestRankings, RankedEntry } from '@/lib/certRanking';

const PRIZES: Record<number, string> = { 1: '₹5,000', 2: '₹3,000', 3: '₹2,000' };
const PODIUM: Record<number, { medal: string; color: string }> = {
  1: { medal: '🥇', color: '#f5c518' },
  2: { medal: '🥈', color: '#c0c0c0' },
  3: { medal: '🥉', color: '#cd7f32' },
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
    <div className="crb-root">
      <style>{`
        .crb-root { background: linear-gradient(135deg, #c41e3a, #a01830); border-radius: 16px; padding: 28px 20px; margin-bottom: 24px; box-shadow: 0 6px 24px rgba(196,30,58,0.3); color: white; text-align: center; }
        .crb-tag { font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #f5c518; margin-bottom: 6px; }
        .crb-heading { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
        .crb-sub { font-size: 13px; opacity: 0.9; margin: 0 0 24px; }
        .crb-podium { display: flex; align-items: flex-end; justify-content: center; gap: 12px; max-width: 520px; margin: 0 auto 24px; flex-wrap: wrap; }
        .crb-item { text-decoration: none; color: inherit; flex: 1 1 140px; max-width: 160px; }
        .crb-medal { font-size: 32px; margin-bottom: 6px; }
        .crb-avatar { width: 52px; height: 52px; border-radius: 50%; background-color: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; margin: 0 auto 8px; }
        .crb-name { font-size: 13px; font-weight: 700; line-height: 1.3; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .crb-prize { font-size: 17px; font-weight: 800; margin-bottom: 10px; }
        .crb-bar { background-color: rgba(255,255,255,0.12); border-radius: 8px 8px 0 0; display: flex; align-items: flex-start; justify-content: center; padding-top: 10px; }
        .crb-bar-1 { height: 150px; }
        .crb-bar-2 { height: 120px; }
        .crb-bar-3 { height: 100px; }
        .crb-rank { font-size: 22px; font-weight: 800; opacity: 0.5; }
        .crb-note { background-color: rgba(255,255,255,0.12); border-radius: 10px; padding: 14px 18px; font-size: 13px; line-height: 1.6; max-width: 560px; margin: 0 auto 18px; }
        .crb-btn { background-color: #f5c518; color: #1a1a1a; border: none; padding: 12px 28px; border-radius: 30px; font-weight: 800; font-size: 14px; cursor: pointer; }

        @media (max-width: 640px) {
          .crb-root { padding: 16px 12px; border-radius: 12px; margin-bottom: 16px; }
          .crb-tag { font-size: 10px; margin-bottom: 4px; }
          .crb-heading { font-size: 16px; margin-bottom: 4px; }
          .crb-sub { font-size: 11px; margin-bottom: 14px; }
          .crb-podium { gap: 6px; margin-bottom: 14px; }
          .crb-item { flex-basis: 90px; max-width: 110px; }
          .crb-medal { font-size: 20px; margin-bottom: 2px; }
          .crb-avatar { width: 34px; height: 34px; font-size: 11px; margin-bottom: 4px; }
          .crb-name { font-size: 10px; margin-bottom: 2px; }
          .crb-prize { font-size: 13px; margin-bottom: 6px; }
          .crb-bar { padding-top: 4px; border-radius: 6px 6px 0 0; }
          .crb-bar-1 { height: 70px; }
          .crb-bar-2 { height: 56px; }
          .crb-bar-3 { height: 46px; }
          .crb-rank { font-size: 13px; }
          .crb-note { padding: 10px 12px; font-size: 11px; line-height: 1.5; margin-bottom: 12px; }
          .crb-btn { padding: 9px 18px; font-size: 12px; }
        }
      `}</style>

      <div className="crb-tag">🎉 Announcement</div>
      <h2 className="crb-heading">Story Contest 2026 — Results Are In!</h2>
      <p className="crb-sub">Congratulations to our winners, and thank you to everyone who took part.</p>

      {/* PODIUM */}
      <div className="crb-podium">
        {order.map((entry) => {
          const p = PODIUM[entry.rank];
          return (
            <Link key={entry.articleId} href={'/article/' + entry.articleId} className="crb-item">
              <div className="crb-medal">{p.medal}</div>
              <div className="crb-avatar" style={{ border: '2px solid ' + p.color }}>{getInitials(entry.submitterName)}</div>
              <div className="crb-name">{entry.submitterName}</div>
              <div className="crb-prize" style={{ color: p.color }}>{PRIZES[entry.rank]}</div>
              <div className={'crb-bar crb-bar-' + entry.rank} style={{ borderTop: '3px solid ' + p.color }}>
                <span className="crb-rank">#{entry.rank}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="crb-note">
        🎓 Every participant will receive an official <strong>E-Certificate</strong> on their profile — winners get their placement certificate, everyone else gets a participation certificate. All done wonderfully!
      </div>

      <Link href="/profile" style={{ textDecoration: 'none' }}>
        <button className="crb-btn">
          👤 My Profile — Check Your Prize & Certificate
        </button>
      </Link>
    </div>
  );
}
