'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PatroDay, PatroEvent } from '@/lib/patro/data';
import {
  BS_MONTHS, FESTIVALS, GREG_MONTHS, LUNAR_MONTHS, NAKSHATRA, WEEKDAYS, WEEKDAYS_SHORT, YOGA,
  clock, festivalName, karanaName, num, pick, range, tithiName, type Lang,
} from '@/lib/patro/names';
import styles from './Patro.module.css';

interface Props {
  year: number;
  month: number; // 1-12
  days: PatroDay[];
  events: PatroEvent[]; // every generated year, sorted by date
  prev: string | null; // YYYY-MM
  next: string | null;
  current: string; // YYYY-MM of the real current month (for the "This month" link)
  slugs: string[]; // every month that has data
}

const LANG_KEY = 'patro-lang';

function istToday(): string {
  const t = new Date(Date.now() + 330 * 60000);
  return t.toISOString().slice(0, 10);
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3);

export default function PatroClient({ year, month, days, events, prev, next, current, slugs }: Props) {
  const [lang, setLang] = useState<Lang>('en');
  const [today, setToday] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(days[0].d);
  const detailRef = useRef<HTMLElement>(null);
  // on narrow screens the detail panel sits below the grid, so bring it into view after a tap
  const pickDay = (date: string) => {
    setSelected(date);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  useEffect(() => {
    try { const l = localStorage.getItem(LANG_KEY); if (l === 'ne' || l === 'en') setLang(l); } catch { /* storage unavailable */ }
    const t = istToday();
    setToday(t);
    if (days.some((d) => d.d === t)) setSelected(t);
    else setSelected(days[0].d);
  }, [days]);

  const chooseLang = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  };

  const eventsByDate = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of events) { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date)!.push(e.id); }
    return m;
  }, [events]);

  const day = days.find((d) => d.d === selected) || days[0];
  const monthEvents = events.filter((e) => e.date.startsWith(`${year}-${String(month).padStart(2, '0')}-`));
  const upcoming = today ? events.filter((e) => e.date >= today).slice(0, 8) : [];

  const first = days[0], last = days[days.length - 1];
  const bsLabel = (d: PatroDay) => `${pick(BS_MONTHS[d.bs[1] - 1], lang)} ${num(d.bs[0], lang)}`;
  const bsRange = bsLabel(first) === bsLabel(last) ? bsLabel(first) : `${bsLabel(first)} – ${bsLabel(last)}`;
  const monthTitle = `${pick(GREG_MONTHS[month - 1], lang)} ${num(year, lang)}`;

  const L = (en: string, ne: string) => (lang === 'ne' ? ne : en);
  const tName = (i: number, withPaksha = true) => tithiName(i, lang, withPaksha);
  const monthLabel = (d: PatroDay) => {
    // purnimanta naming for Krishna paksha (used in north India and Nepal), amanta for Shukla
    const idx = d.t[0][0];
    const lm = idx >= 15 ? (d.lm + 1) % 12 : d.lm;
    return `${d.adhik ? L('Adhik ', 'अधिक ') : ''}${pick(LUNAR_MONTHS[lm], lang)}`;
  };

  const selectedFest = eventsByDate.get(day.d) || [];
  const tithiIdx = day.t[0][0];
  const dayWeekday = pick(WEEKDAYS[day.wd], lang);
  const dateLong = `${dayWeekday}, ${num(Number(day.d.slice(8)), lang)} ${pick(GREG_MONTHS[Number(day.d.slice(5, 7)) - 1], lang)} ${num(day.d.slice(0, 4), lang)}`;
  const bsLong = `${num(day.bs[2], lang)} ${pick(BS_MONTHS[day.bs[1] - 1], lang)} ${num(day.bs[0], lang)} ${L('BS', 'वि.सं.')}`;

  const limbRows = (list: [number, number][], name: (i: number) => string) =>
    list.map(([i, end], n) => (
      <div key={n} className={styles.limb}>
        <span>{name(i)}</span>
        <span className={styles.until}>{L('until', 'सम्म')} {clock(end, lang)}</span>
      </div>
    ));

  const countdown = (date: string) => {
    if (!today) return '';
    const n = dayDiff(today, date);
    if (n === 0) return L('Today', 'आज');
    if (n === 1) return L('Tomorrow', 'भोलि');
    return L(`in ${n} days`, `${num(n, lang)} दिनमा`);
  };

  const shortDate = (date: string) => `${num(Number(date.slice(8)), lang)} ${pick(GREG_MONTHS[Number(date.slice(5, 7)) - 1], lang).slice(0, lang === 'ne' ? 20 : 3)}`;

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/" className={styles.brand}>
            <img src="/assets/logo.png" alt="" width={36} height={36} className={styles.logo} />
            <span>Khabar Darjeeling</span>
          </Link>
          <Link href="/" className={styles.homeLink}>{L('Home', 'गृहपृष्ठ')}</Link>
        </div>
      </div>

      <main className={styles.wrap}>
        <header className={styles.head}>
          <div>
            <p className={styles.kicker}>{L('Darjeeling Calendar', 'दार्जिलिङ पात्रो')}</p>
            <h1 className={styles.h1}>{L(`Calendar · ${monthTitle}`, `पात्रो · ${monthTitle}`)}</h1>
            <p className={styles.sub}>
              {L('Indian panchang, tithi and festivals for Darjeeling, with Nepali (BS) dates alongside.', 'दार्जिलिङका लागि भारतीय पञ्चाङ्ग, तिथि र चाडपर्व — नेपाली (वि.सं.) मिति सहित।')}
            </p>
          </div>
          <div className={styles.langSwitch} role="group" aria-label={L('Language', 'भाषा')}>
            <button type="button" className={lang === 'en' ? styles.langOn : ''} onClick={() => chooseLang('en')} aria-pressed={lang === 'en'}>English</button>
            <button type="button" className={lang === 'ne' ? styles.langOn : ''} onClick={() => chooseLang('ne')} aria-pressed={lang === 'ne'}>नेपाली</button>
          </div>
        </header>

        <nav className={styles.monthNav} aria-label={L('Choose month', 'महिना छान्नुहोस्')}>
          {prev ? <Link href={`/calendar/${prev}`} className={styles.navBtn} aria-label={L('Previous month', 'अघिल्लो महिना')}>‹</Link> : <span className={`${styles.navBtn} ${styles.navOff}`}>‹</span>}
          <div className={styles.monthTitle}>
            <strong>{monthTitle}</strong>
            <span>{bsRange} · {L('Lunar', 'चन्द्र')} {monthLabel(first)}{monthLabel(first) !== monthLabel(last) ? ` – ${monthLabel(last)}` : ''}</span>
          </div>
          {next ? <Link href={`/calendar/${next}`} className={styles.navBtn} aria-label={L('Next month', 'अर्को महिना')}>›</Link> : <span className={`${styles.navBtn} ${styles.navOff}`}>›</span>}
          <Link href={`/calendar/${current}`} className={styles.todayBtn}>{L('This month', 'यो महिना')}</Link>
          <Link href="/calendar/converter" className={styles.todayBtn}>{L('Date converter', 'मिति रूपान्तरण')}</Link>
          <select
            className={styles.jump}
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={(e) => { window.location.href = `/calendar/${e.target.value}`; }}
            aria-label={L('Jump to month', 'महिनामा जानुहोस्')}
          >
            {slugs.map((s) => {
              const [sy, sm] = s.split('-').map(Number);
              return <option key={s} value={s}>{pick(GREG_MONTHS[sm - 1], lang)} {num(sy, lang)}</option>;
            })}
          </select>
        </nav>

        <div className={styles.layout}>
          <section aria-label={L('Month calendar', 'महिनाको पात्रो')}>
            <div className={styles.grid} role="grid">
              {WEEKDAYS_SHORT.map((w, i) => (
                <div key={i} className={`${styles.dow} ${i === 0 ? styles.sun : ''}`} role="columnheader">{pick(w, lang)}</div>
              ))}
              {Array.from({ length: first.wd }).map((_, i) => <div key={'b' + i} className={styles.blank} />)}
              {days.map((d) => {
                const fest = eventsByDate.get(d.d) || [];
                const ti = d.t[0][0];
                const isHoliday = fest.some((f) => FESTIVALS[f]?.holiday);
                const cls = [
                  styles.cell,
                  d.wd === 0 || isHoliday ? styles.red : '',
                  d.d === today ? styles.isToday : '',
                  d.d === selected ? styles.isSelected : '',
                ].join(' ');
                return (
                  <button
                    key={d.d}
                    type="button"
                    className={cls}
                    onClick={() => pickDay(d.d)}
                    aria-pressed={d.d === selected}
                    aria-label={`${num(Number(d.d.slice(8)), lang)} ${pick(GREG_MONTHS[month - 1], lang)}, ${tName(ti)}${fest.length ? ', ' + fest.map((f) => festivalName(f, lang)).join(', ') : ''}`}
                  >
                    <span className={styles.gd}>{num(Number(d.d.slice(8)), lang)}</span>
                    <span className={styles.bd}>{num(d.bs[2], lang)}</span>
                    <span className={styles.tithi}>
                      {ti === 14 && <i className={styles.full} aria-hidden="true" />}
                      {ti === 29 && <i className={styles.new} aria-hidden="true" />}
                      <span className={styles.tithiText}>{tName(ti, false)}</span>
                    </span>
                    {fest.length > 0 && (
                      <>
                        <span className={styles.fest}>{festivalName(fest[0], lang).replace(/ \(.*\)$/, '')}{fest.length > 1 ? ` +${num(fest.length - 1, lang)}` : ''}</span>
                        <span className={styles.dot} aria-hidden="true" />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <p className={styles.legend}>
              <i className={styles.full} aria-hidden="true" /> {L('Purnima', 'पूर्णिमा')}
              <i className={styles.new} aria-hidden="true" /> {L('Amavasya', 'औंसी')}
              <span className={styles.legendRed}>{L('Red: Sunday or public holiday', 'रातो: आइतबार वा सार्वजनिक बिदा')}</span>
            </p>
          </section>

          <aside ref={detailRef} className={styles.detail} aria-live="polite">
            <p className={styles.kicker}>{L('Selected day', 'चयन गरिएको दिन')}</p>
            <h2 className={styles.dayTitle}>{dateLong}</h2>
            <p className={styles.bsLine}>{bsLong} · {monthLabel(day)} {tName(tithiIdx)}</p>
            {selectedFest.length > 0 && (
              <ul className={styles.dayFests}>
                {selectedFest.map((f) => <li key={f}>{festivalName(f, lang)}{FESTIVALS[f]?.holiday ? <em>{L('Holiday', 'बिदा')}</em> : null}</li>)}
              </ul>
            )}

            <dl className={styles.dl}>
              <dt>{L('Tithi', 'तिथि')}</dt><dd>{limbRows(day.t, (i) => tName(i))}</dd>
              <dt>{L('Nakshatra', 'नक्षत्र')}</dt><dd>{limbRows(day.n, (i) => pick(NAKSHATRA[i], lang))}</dd>
              <dt>{L('Yoga', 'योग')}</dt><dd>{limbRows(day.y, (i) => pick(YOGA[i], lang))}</dd>
              <dt>{L('Karana', 'करण')}</dt><dd>{limbRows(day.k, (i) => karanaName(i, lang))}</dd>
            </dl>

            <div className={styles.times}>
              <div><span>{L('Sunrise', 'सूर्योदय')}</span><b>{clock(day.sr, lang)}</b></div>
              <div><span>{L('Sunset', 'सूर्यास्त')}</span><b>{clock(day.ss, lang)}</b></div>
              <div><span>{L('Moonrise', 'चन्द्रोदय')}</span><b>{clock(day.mr, lang)}</b></div>
              <div><span>{L('Moonset', 'चन्द्रास्त')}</span><b>{clock(day.ms, lang)}</b></div>
            </div>

            <h3 className={styles.h3}>{L('Muhurta', 'मुहूर्त')}</h3>
            <dl className={styles.dl}>
              <dt className={styles.good}>{L('Abhijit', 'अभिजित्')}</dt><dd>{day.ab ? range(day.ab, lang) : L('Not observed on Wednesday', 'बुधबार अभिजित् मानिँदैन')}</dd>
              <dt className={styles.good}>{L('Brahma Muhurta', 'ब्रह्म मुहूर्त')}</dt><dd>{range(day.bm, lang)}</dd>
              <dt className={styles.bad}>{L('Rahu Kaal', 'राहु काल')}</dt><dd>{range(day.rk, lang)}</dd>
              <dt className={styles.bad}>{L('Yamaganda', 'यमगण्ड')}</dt><dd>{range(day.ym, lang)}</dd>
              <dt className={styles.bad}>{L('Gulika', 'गुलिक')}</dt><dd>{range(day.gk, lang)}</dd>
            </dl>
          </aside>
        </div>

        <div className={styles.lists}>
          <section>
            <h2 className={styles.h2}>{L(`Festivals in ${pick(GREG_MONTHS[month - 1], 'en')}`, `${pick(GREG_MONTHS[month - 1], 'ne')} का चाडपर्व`)}</h2>
            {monthEvents.length === 0 ? <p className={styles.muted}>{L('No major festivals this month.', 'यो महिना ठूला चाडपर्व छैनन्।')}</p> : (
              <ul className={styles.list}>
                {monthEvents.map((e) => (
                  <li key={e.id + e.date}>
                    <button type="button" onClick={() => pickDay(e.date)} className={styles.listBtn}>
                      <span className={styles.listDate}>{shortDate(e.date)}</span>
                      <span>{festivalName(e.id, lang)}</span>
                      {FESTIVALS[e.id]?.holiday && <em>{L('Holiday', 'बिदा')}</em>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className={styles.h2}>{L('Coming up', 'आउँदै गरेका चाडपर्व')}</h2>
            {upcoming.length === 0 ? <p className={styles.muted}>{today ? L('No more festivals listed.', 'अरू चाडपर्व सूचीमा छैनन्।') : ' '}</p> : (
              <ul className={styles.list}>
                {upcoming.map((e) => (
                  <li key={e.id + e.date}>
                    <Link href={`/calendar/${e.date.slice(0, 7)}`} className={styles.listBtn}>
                      <span className={styles.listDate}>{shortDate(e.date)}</span>
                      <span>{festivalName(e.id, lang)}</span>
                      <em className={styles.count}>{countdown(e.date)}</em>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <p className={styles.subscribe}>
          {L('Get these festivals in your phone or Google Calendar:', 'यी चाडपर्व आफ्नो फोन वा गुगल क्यालेन्डरमा पाउनुहोस्:')}{' '}
          <a href="webcal://khabardarjeeling.in/calendar/festivals.ics">{L('Subscribe', 'सब्सक्राइब')}</a>{' · '}
          <a href="/calendar/festivals.ics" download="darjeeling-festivals.ics">{L('Download .ics file', '.ics फाइल डाउनलोड')}</a>
        </p>

        <p className={styles.note}>
          {L(
            'Panchang is calculated for Darjeeling (27.04° N, 88.26° E) in Indian Standard Time using the Lahiri ayanamsha, and cross-checked against Drik Panchang. The day’s tithi is the one running at sunrise. Festival dates follow the usual rules and can differ by a day in some traditions or villages. Eid, Muharram and other moon-sighting dates are not included. Tihar days for the hills (Kaag, Kukur and Gai Tihar) are not listed yet.',
            'पञ्चाङ्ग दार्जिलिङ (२७.०४° उ., ८८.२६° पू.) का लागि भारतीय मानक समयमा लाहिरी अयनांशबाट गणना गरिएको हो र द्रिक पञ्चाङ्गसँग तुलना गरिएको छ। दिनको तिथि सूर्योदयमा चलिरहेको तिथि हो। चाडपर्वको मिति सामान्य नियम अनुसार हो र केही परम्परा वा ठाउँमा एक दिन फरक पर्न सक्छ। ईद, मुहर्रम जस्ता चन्द्र-दर्शनमा आधारित चाड समावेश छैनन्। पहाडका काग, कुकुर र गाई तिहार अहिले सूचीमा छैनन्।',
          )}
        </p>
      </main>
    </div>
  );
}
