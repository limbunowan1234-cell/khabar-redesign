'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TodayPayload } from '@/lib/patro/today';
import {
  BS_MONTHS, GREG_MONTHS, LUNAR_MONTHS, NAKSHATRA, WEEKDAYS, clock, festivalName, num, pick, tithiName, type Lang,
} from '@/lib/patro/names';

// "Today in Darjeeling": BS date, tithi, nakshatra, sunrise/sunset and the next festival.
// Language follows the choice made on the calendar page (localStorage 'patro-lang').
export default function TodayCard({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<TodayPayload | null | undefined>(undefined); // undefined = loading, null = unavailable
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    try { const l = localStorage.getItem('patro-lang'); if (l === 'ne' || l === 'en') setLang(l); } catch { /* ignore */ }
    let live = true;
    fetch('/api/calendar/today')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setData(j); })
      .catch(() => { if (live) setData(null); });
    return () => { live = false; };
  }, []);

  if (data === null) return null; // quietly hide if the date is outside the generated years

  const L = (en: string, ne: string) => (lang === 'ne' ? ne : en);
  const loading = data === undefined;

  if (compact) {
    return (
      <Link href="/calendar" style={{ display: 'block', minHeight: 40, padding: '10px 16px', borderBottom: '1px solid var(--rule)', background: 'var(--color-bg)', color: 'var(--color-text)', textDecoration: 'none', fontSize: '13px', lineHeight: 1.4 }}>
        {loading ? <span style={{ color: 'var(--color-text-muted)' }}>{L('Today in Darjeeling…', 'आजको मिति…')}</span> : (() => {
          const d = data!;
          const next = d.events[0] ? festivalName(d.events[0], lang) : d.upcoming[0] ? `${festivalName(d.upcoming[0].id, lang)} ${L(d.upcoming[0].inDays === 1 ? 'tomorrow' : `in ${d.upcoming[0].inDays} days`, d.upcoming[0].inDays === 1 ? 'भोलि' : `${num(d.upcoming[0].inDays, lang)} दिनमा`)}` : '';
          return (
            <>
              <strong>{num(d.bs[2], lang)} {pick(BS_MONTHS[d.bs[1] - 1], lang)} {num(d.bs[0], lang)}</strong>
              <span style={{ color: 'var(--color-text-muted)' }}> · {tithiName(d.tithi[0], lang)}</span>
              {next && <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}> · {next}</span>}
            </>
          );
        })()}
      </Link>
    );
  }

  return (
    <section aria-label={L('Today in Darjeeling', 'आज दार्जिलिङमा')} style={{ border: '1px solid var(--rule)', borderTop: '3px solid var(--rule-strong)', background: 'var(--color-bg)', marginBottom: '16px', minHeight: 190 }}>
      <div style={{ padding: '12px 14px 10px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-primary)' }}>{L('Today in Darjeeling', 'आज दार्जिलिङमा')}</p>
        {loading ? <p style={{ margin: '14px 0 0', fontSize: '13px', color: 'var(--color-text-muted)' }}>{L('Loading…', 'लोड हुँदैछ…')}</p> : (() => {
          const d = data!;
          const gDay = Number(d.date.slice(8)), gMonth = Number(d.date.slice(5, 7)) - 1;
          const lm = d.tithi[0] >= 15 ? (d.lm + 1) % 12 : d.lm;
          return (
            <>
              <h2 style={{ margin: '6px 0 0', fontFamily: 'var(--font-serif)', fontSize: '22px', lineHeight: 1.2, color: 'var(--ink)' }}>
                {pick(WEEKDAYS[d.wd], lang)}, {num(gDay, lang)} {pick(GREG_MONTHS[gMonth], lang)}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: 'var(--color-text-muted)' }}>
                {num(d.bs[2], lang)} {pick(BS_MONTHS[d.bs[1] - 1], lang)} {num(d.bs[0], lang)} {L('BS', 'वि.सं.')}
              </p>
              {d.events.map((id) => (
                <p key={id} style={{ margin: '10px 0 0', padding: '6px 10px', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, fontSize: '13.5px' }}>{festivalName(id, lang)}</p>
              ))}
              <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', margin: '12px 0 0', fontSize: '13px' }}>
                <dt style={{ color: 'var(--color-text-muted)' }}>{L('Tithi', 'तिथि')}</dt>
                <dd style={{ margin: 0 }}>{d.adhik ? L('Adhik ', 'अधिक ') : ''}{pick(LUNAR_MONTHS[lm], lang)} {tithiName(d.tithi[0], lang)} <span style={{ color: 'var(--color-text-muted)' }}>{L('until', 'सम्म')} {clock(d.tithi[1], lang)}</span></dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>{L('Nakshatra', 'नक्षत्र')}</dt>
                <dd style={{ margin: 0 }}>{pick(NAKSHATRA[d.nakshatra[0]], lang)}</dd>
                <dt style={{ color: 'var(--color-text-muted)' }}>{L('Sun', 'सूर्य')}</dt>
                <dd style={{ margin: 0 }}>{clock(d.sr, lang)} – {clock(d.ss, lang)}</dd>
              </dl>
              {d.upcoming.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: '10px 0 0', borderTop: '1px solid var(--rule)', fontSize: '13px' }}>
                  {d.upcoming.slice(0, 3).map((u) => (
                    <li key={u.id + u.date} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '2px 0' }}>
                      <span>{festivalName(u.id, lang).replace(/ \(.*\)$/, '')}</span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{u.inDays === 1 ? L('Tomorrow', 'भोलि') : L(`in ${u.inDays} days`, `${num(u.inDays, lang)} दिनमा`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        })()}
      </div>
      <Link href="/calendar" style={{ display: 'block', padding: '9px 14px', borderTop: '1px solid var(--rule)', background: 'var(--panel-bg)', color: 'var(--color-primary)', fontSize: '12.5px', fontWeight: 700, textDecoration: 'none' }}>
        {L('Full calendar, festivals and date converter →', 'पूरा पात्रो, चाडपर्व र मिति रूपान्तरण →')}
      </Link>
    </section>
  );
}
