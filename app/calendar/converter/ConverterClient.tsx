'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import NepaliDate from 'nepali-date-converter';
import { BS_MONTHS, GREG_MONTHS, WEEKDAYS, num, pick, type Lang } from '@/lib/patro/names';
import { hasMonth } from '@/lib/patro/data';
import styles from '../Patro.module.css';
import cv from './Converter.module.css';

// Supported range of the BS table: BS 2000-01-01 .. 2090-12-30
const BS_MIN = 2000, BS_MAX = 2090;
const LANG_KEY = 'patro-lang';
type Mode = 'ad' | 'bs';

const pad = (n: number) => String(n).padStart(2, '0');
const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

/** days in a BS month, found by round-tripping each candidate day through the converter */
function bsMonthLength(y: number, m: number): number {
  for (let d = 32; d >= 28; d--) {
    try {
      const nd = new NepaliDate(y, m, d);
      if (nd.getYear() === y && nd.getMonth() === m && nd.getDate() === d) return d;
    } catch { /* not a valid day */ }
  }
  return 30;
}

interface Result { ad: Date; bs: [number, number, number] }

function fromAD(iso: string): Result | string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return 'Pick a date.';
  const ad = new Date(y, m - 1, d);
  try {
    const nd = new NepaliDate(ad);
    return { ad, bs: [nd.getYear(), nd.getMonth(), nd.getDate()] };
  } catch {
    return 'That date is outside the supported range (1943 to 2033 AD, BS 2000 to 2090).';
  }
}
function fromBS(y: number, m: number, d: number): Result | string {
  if (!(y >= BS_MIN && y <= BS_MAX)) return `Enter a BS year between ${BS_MIN} and ${BS_MAX}.`;
  try {
    const nd = new NepaliDate(y, m, d);
    if (nd.getYear() !== y || nd.getMonth() !== m || nd.getDate() !== d) return 'That BS date does not exist.';
    return { ad: nd.toJsDate(), bs: [y, m, d] };
  } catch {
    return 'That BS date is outside the supported range.';
  }
}

export default function ConverterClient() {
  const [lang, setLang] = useState<Lang>('en');
  const [mode, setMode] = useState<Mode>('ad');
  const [adValue, setAdValue] = useState('');
  const [bsY, setBsY] = useState(2083);
  const [bsM, setBsM] = useState(0);
  const [bsD, setBsD] = useState(1);

  const setToday = () => {
    const t = istToday();
    setAdValue(t);
    const r = fromAD(t);
    if (typeof r !== 'string') { setBsY(r.bs[0]); setBsM(r.bs[1]); setBsD(r.bs[2]); }
  };

  useEffect(() => {
    try { const l = localStorage.getItem(LANG_KEY); if (l === 'ne' || l === 'en') setLang(l); } catch { /* ignore */ }
    setToday();
  }, []);
  const chooseLang = (l: Lang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ } };
  const L = (en: string, ne: string) => (lang === 'ne' ? ne : en);

  const monthLen = useMemo(() => (bsY >= BS_MIN && bsY <= BS_MAX ? bsMonthLength(bsY, bsM) : 30), [bsY, bsM]);
  const dayOk = Math.max(1, Math.min(bsD || 1, monthLen));

  const result = mode === 'ad' ? (adValue ? fromAD(adValue) : null) : fromBS(bsY, bsM, dayOk);

  const view = (r: Result) => {
    const adY = r.ad.getFullYear(), adM = r.ad.getMonth(), adD = r.ad.getDate();
    const wd = pick(WEEKDAYS[r.ad.getDay()], lang);
    const calSlug = `${adY}-${pad(adM + 1)}`;
    return {
      bsText: `${num(r.bs[2], lang)} ${pick(BS_MONTHS[r.bs[1]], lang)} ${num(r.bs[0], lang)} ${L('BS', 'वि.सं.')}`,
      adText: `${num(adD, lang)} ${pick(GREG_MONTHS[adM], lang)} ${num(adY, lang)}`,
      wd,
      link: hasMonth(adY, adM + 1) ? `/calendar/${calSlug}` : null,
    };
  };
  const v = result && typeof result !== 'string' ? view(result) : null;

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
            <p className={styles.kicker}><Link href="/calendar" style={{ color: 'inherit', textDecoration: 'none' }}>{L('Darjeeling Calendar', 'दार्जिलिङ पात्रो')}</Link></p>
            <h1 className={styles.h1}>{L('Nepali date converter', 'मिति रूपान्तरण')}</h1>
            <p className={styles.sub}>{L('Turn an English (AD) date into a Nepali Bikram Sambat (BS) date, or the other way round.', 'अंग्रेजी (ई.सं.) मितिलाई विक्रम सम्वत् (वि.सं.) मा, वा विक्रम सम्वत्लाई अंग्रेजी मितिमा बदल्नुहोस्।')}</p>
          </div>
          <div className={styles.langSwitch} role="group" aria-label={L('Language', 'भाषा')}>
            <button type="button" className={lang === 'en' ? styles.langOn : ''} onClick={() => chooseLang('en')} aria-pressed={lang === 'en'}>English</button>
            <button type="button" className={lang === 'ne' ? styles.langOn : ''} onClick={() => chooseLang('ne')} aria-pressed={lang === 'ne'}>नेपाली</button>
          </div>
        </header>

        <div className={cv.card}>
          <div className={cv.tabs} role="tablist" aria-label={L('Direction', 'दिशा')}>
            <button type="button" role="tab" aria-selected={mode === 'ad'} className={mode === 'ad' ? cv.tabOn : ''} onClick={() => setMode('ad')}>{L('AD → BS', 'ई.सं. → वि.सं.')}</button>
            <button type="button" role="tab" aria-selected={mode === 'bs'} className={mode === 'bs' ? cv.tabOn : ''} onClick={() => setMode('bs')}>{L('BS → AD', 'वि.सं. → ई.सं.')}</button>
          </div>

          {mode === 'ad' ? (
            <label className={cv.field}>
              <span>{L('English date (AD)', 'अंग्रेजी मिति (ई.सं.)')}</span>
              <input type="date" value={adValue} min="1943-04-14" max="2033-12-31" onChange={(e) => setAdValue(e.target.value)} />
            </label>
          ) : (
            <div className={cv.row}>
              <label className={cv.field}>
                <span>{L('Year (BS)', 'साल (वि.सं.)')}</span>
                <input type="number" inputMode="numeric" value={bsY} min={BS_MIN} max={BS_MAX} onChange={(e) => setBsY(Number(e.target.value))} />
              </label>
              <label className={cv.field}>
                <span>{L('Month', 'महिना')}</span>
                <select value={bsM} onChange={(e) => setBsM(Number(e.target.value))}>
                  {BS_MONTHS.map((m, i) => <option key={i} value={i}>{pick(m, lang)}</option>)}
                </select>
              </label>
              <label className={cv.field}>
                <span>{L('Day', 'गते')}</span>
                <select value={dayOk} onChange={(e) => setBsD(Number(e.target.value))}>
                  {Array.from({ length: monthLen }, (_, i) => <option key={i} value={i + 1}>{num(i + 1, lang)}</option>)}
                </select>
              </label>
            </div>
          )}

          <button type="button" className={cv.todayBtn} onClick={() => { setToday(); }}>{L('Use today’s date', 'आजको मिति')}</button>

          <div className={cv.result} aria-live="polite">
            {typeof result === 'string' && <p className={cv.error}>{result}</p>}
            {v && (
              <>
                <p className={cv.big}>{mode === 'ad' ? v.bsText : v.adText}</p>
                <p className={cv.small}>{v.wd} · {mode === 'ad' ? v.adText : v.bsText}</p>
                {v.link && <Link href={v.link} className={cv.link}>{L('See tithi and festivals in this month →', 'यो महिनाको तिथि र चाडपर्व हेर्नुहोस् →')}</Link>}
              </>
            )}
          </div>
        </div>

        <p className={styles.note}>
          {L(
            'Uses the Bikram Sambat calendar table for BS 2000 to 2090 (April 1943 to April 2034). Month lengths in BS change from year to year, and Nepal’s official calendar is the final word for any date; check it for legal or official use.',
            'यो विक्रम सम्वत् २००० देखि २०९० (अप्रिल १९४३ देखि अप्रिल २०३४) सम्मको पात्रो तालिकामा आधारित छ। वि.सं. का महिनाको दिन हरेक वर्ष फरक हुन्छन्, र कुनै पनि मितिका लागि नेपालको आधिकारिक पात्रो नै अन्तिम हो; कानुनी वा आधिकारिक प्रयोगमा त्यही हेर्नुहोस्।',
          )}
        </p>
      </main>
    </div>
  );
}
