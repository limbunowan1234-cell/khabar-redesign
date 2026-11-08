// Panchang engine for Darjeeling (Indian calendar, Lahiri ayanamsha, IST).
//
// Everything here runs at build time only (scripts/patro/generate.mjs) and its output is
// committed as data/patro/<year>.json, so the website has no astronomy dependency at runtime.
//
// Accuracy was fitted and checked against Drik Panchang for Darjeeling (geoname-id 1273467):
// tithi / nakshatra / yoga / karana boundaries within ~1-2 minutes, sunrise/sunset within ~1 minute.
// Moonrise/moonset can differ by a few minutes (limb/refraction conventions).
import * as Astronomy from 'astronomy-engine';
import NepaliDate from 'nepali-date-converter';
import { OVERRIDES } from './overrides.mjs';

export const PLACE = { name: 'Darjeeling', lat: 27.036, lon: 88.2627, elevation: 0 };
const IST = 330; // minutes ahead of UTC
const observer = new Astronomy.Observer(PLACE.lat, PLACE.lon, PLACE.elevation);
const norm = (x) => ((x % 360) + 360) % 360;
const addMin = (d, m) => new Date(d.getTime() + m * 60000);
const addH = (d, h) => new Date(d.getTime() + h * 3600e3);

// Lahiri ayanamsha: 23.853056 deg at J2000 drifting with precession (~50.29"/yr).
// 24.2278 deg around 2026 matches Drik's nakshatra/yoga boundaries within ~1.5 min.
const AYAN_J2000 = 23.853056;
const ayan = (d) => AYAN_J2000 + ((d.getTime() - Date.UTC(2000, 0, 1, 12)) / 31557600000) * (50.2879 / 3600);
const eclLon = (body, d) => Astronomy.Ecliptic(Astronomy.GeoVector(body, d, true)).elon; // J2000 ecliptic
export const sidMoon = (d) => norm(eclLon(Astronomy.Body.Moon, d) - ayan(d));
export const sidSun = (d) => norm(eclLon(Astronomy.Body.Sun, d) - ayan(d));
const elong = (d) => Astronomy.MoonPhase(d); // 0..360, Moon minus Sun

const LIMBS = {
  tithi: { f: elong, step: 12, count: 30, window: 30 },
  nakshatra: { f: sidMoon, step: 360 / 27, count: 27, window: 32 },
  yoga: { f: (d) => norm(sidMoon(d) + sidSun(d)), step: 360 / 27, count: 27, window: 32 },
  karana: { f: elong, step: 6, count: 60, window: 16 },
};
const limbIdx = (limb, d) => Math.floor(LIMBS[limb].f(d) / LIMBS[limb].step) % LIMBS[limb].count;

// next time after d0 when `limb` finishes limb number idx
function crossing(limb, d0, idx) {
  const L = LIMBS[limb];
  const target = ((idx + 1) % L.count) * L.step;
  const g = (d) => ((L.f(d) - target + 540) % 360) - 180;
  let a = d0, b = addH(d0, L.window);
  for (let i = 0; i < 40; i++) {
    const m = new Date((a.getTime() + b.getTime()) / 2);
    if (g(m) < 0) a = m; else b = m;
  }
  return b;
}

const midnightIST = (y, m, d) => Date.UTC(y, m - 1, d) - IST * 60000;
const minutesSince = (date, midnightMs) => Math.round((date.getTime() - midnightMs) / 60000);
const search = (body, dir, from, days = 1.5) => {
  const t = Astronomy.SearchRiseSet(body, observer, dir, from, days);
  return t ? t.date : null;
};

// ---------- lunar months (amanta), with adhik detection ----------
// Month name comes from the Sun's sidereal sign at the new moon that starts the month.
// 0 Chaitra 1 Vaishakha 2 Jyeshtha 3 Ashadha 4 Shravana 5 Bhadrapada 6 Ashwin 7 Kartik 8 Margashirsha 9 Pausha 10 Magha 11 Phalguna
export function newMoons(fromDate, toDate) {
  const out = [];
  let t = Astronomy.SearchMoonPhase(0, fromDate, 40)?.date;
  while (t && t < toDate) {
    out.push({ t, rashi: Math.floor(sidSun(t) / 30) });
    t = Astronomy.SearchMoonPhase(0, addH(t, 24 * 20), 40)?.date;
  }
  for (let i = 0; i < out.length; i++) {
    out[i].month = (out[i].rashi + 1) % 12;
    // no sankranti inside the month (same sign at both ends) => adhik
    out[i].adhik = i + 1 < out.length && out[i + 1].rashi === out[i].rashi;
  }
  return out;
}
const monthAt = (moons, t) => {
  let cur = null;
  for (const m of moons) { if (m.t <= t) cur = m; else break; }
  return cur;
};

// ---------- day computation ----------
const WEEKDAY_RAHU = [8, 2, 7, 5, 6, 4, 3]; // Sun..Sat -> 1-based eighth of the daytime
const WEEKDAY_YAMA = [5, 4, 3, 2, 1, 7, 6];
const WEEKDAY_GULI = [7, 6, 5, 4, 3, 2, 1];

export function computeDay(y, m, d, moons) {
  const mid = midnightIST(y, m, d);
  const dayStart = new Date(mid);
  const sunrise = search(Astronomy.Body.Sun, +1, dayStart);
  const sunset = search(Astronomy.Body.Sun, -1, sunrise);
  const nextSunrise = search(Astronomy.Body.Sun, +1, addH(sunrise, 20));
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  const limbs = {};
  for (const limb of ['tithi', 'nakshatra', 'yoga', 'karana']) {
    const list = [];
    let idx = limbIdx(limb, sunrise);
    let cursor = sunrise;
    for (let n = 0; n < 5; n++) {
      const end = crossing(limb, cursor, idx);
      list.push([idx, minutesSince(end, mid)]);
      if (end >= nextSunrise) break;
      cursor = end;
      idx = (idx + 1) % LIMBS[limb].count;
    }
    limbs[limb] = list;
  }

  // Moonrise / moonset inside the sunrise -> next sunrise window (the Hindu day), as Drik lists them.
  const mr = search(Astronomy.Body.Moon, +1, sunrise);
  const ms = search(Astronomy.Body.Moon, -1, sunrise);
  const inWin = (t) => (t && t < nextSunrise ? minutesSince(t, mid) : null);

  const srMin = minutesSince(sunrise, mid);
  const ssMin = minutesSince(sunset, mid);
  const day = ssMin - srMin;
  const eighth = day / 8;
  const seg = (n) => [Math.round(srMin + (n - 1) * eighth), Math.round(srMin + n * eighth)];
  const muhurta = day / 15;

  const bs = new NepaliDate(new Date(y, m - 1, d));
  const moon = monthAt(moons, sunrise);

  const rec = {
    d: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    wd,
    bs: [bs.getYear(), bs.getMonth() + 1, bs.getDate()],
    sr: srMin, ss: ssMin, mr: inWin(mr), ms: inWin(ms),
    t: limbs.tithi, n: limbs.nakshatra, y: limbs.yoga, k: limbs.karana,
    lm: moon.month, adhik: moon.adhik ? 1 : 0,
    rk: seg(WEEKDAY_RAHU[wd]), ym: seg(WEEKDAY_YAMA[wd]), gk: seg(WEEKDAY_GULI[wd]),
    // Abhijit: the 8th of 15 muhurtas of the day; Drik does not show it on Wednesdays.
    ab: wd === 3 ? null : [Math.round(srMin + 7 * muhurta), Math.round(srMin + 8 * muhurta)],
    bm: [srMin - 96, srMin - 48], // Brahma Muhurta
  };
  const raw = { sunrise, sunset, nextSunrise, moon };
  return { rec, raw };
}

// ---------- festivals ----------
export const tithiAt = (t) => limbIdx('tithi', t);
const S = (n) => n - 1; // Shukla n  -> index
const K = (n) => 14 + n; // Krishna n -> index (n = 1..14)
const PURNIMA = 14, AMAVASYA = 29;

// Time window of the day in which the tithi must prevail (Drik-style kala). A day qualifies when the
// tithi overlaps the window at all; the first such day wins (unless a rule says pick: 'last').
const dayMin = (r) => (r.sunset - r.sunrise) / 60000;
const frac = (r, a, b) => [addMin(r.sunrise, dayMin(r) * a), addMin(r.sunrise, dayMin(r) * b)];
const WINDOWS = {
  sunrise: (r) => [r.sunrise, r.sunrise],
  arunodaya: (r) => [addMin(r.sunrise, -96), r.sunrise],
  purvahna: (r) => frac(r, 0, 0.4), // forenoon
  forenoon: (r) => frac(r, 0, 0.5), // sunrise to midday
  madhyahna: (r) => frac(r, 0.4, 0.6),
  aparahna: (r) => frac(r, 0.6, 0.8),
  pradosh: (r) => [r.sunset, addMin(r.sunset, 48)],
  nishita: (r) => {
    const mid = (r.sunset.getTime() + r.nextSunrise.getTime()) / 2;
    return [new Date(mid - 24 * 60000), new Date(mid + 24 * 60000)];
  },
};
const isVishti = (t) => { const k = limbIdx('karana', t); return k > 0 && k < 57 && (k - 1) % 7 === 6; };

// month: amanta month index (see newMoons()); `after` places a festival the day after another.
export const LUNAR_FESTIVALS = [
  { id: 'maha-shivaratri', month: 10, tithi: K(14), anchor: 'nishita' },
  // Holika Dahan avoids Bhadra (Vishti); Drik's handling of that varies by year, see overrides.mjs
  { id: 'holika-dahan', month: 11, tithi: PURNIMA, anchor: 'pradosh' },
  { id: 'holi', after: 'holika-dahan' },
  { id: 'ram-navami', month: 0, tithi: S(9), anchor: 'madhyahna' },
  { id: 'hanuman-jayanti', month: 0, tithi: PURNIMA, anchor: 'sunrise' },
  { id: 'akshaya-tritiya', month: 1, tithi: S(3), anchor: 'forenoon' },
  { id: 'buddha-purnima', month: 1, tithi: PURNIMA, anchor: 'sunrise' },
  { id: 'rath-yatra', month: 3, tithi: S(2), anchor: 'sunrise' },
  { id: 'guru-purnima', month: 3, tithi: PURNIMA, anchor: 'sunrise' },
  { id: 'nag-panchami', month: 4, tithi: S(5), anchor: 'madhyahna' },
  // Janai Purnima / Raksha Bandhan: Purnima at sunrise (Raksha Bandhan avoids Bhadra, which this also does)
  { id: 'janai-purnima', month: 4, tithi: PURNIMA, anchor: 'sunrise' },
  { id: 'janmashtami', month: 4, tithi: K(8), anchor: 'sunrise' },
  // Teej: Tritiya touching Chaturthi is preferred, so when Tritiya spans two forenoons the later one wins
  { id: 'haritalika-teej', month: 5, tithi: S(3), anchor: 'purvahna', pick: 'last' },
  { id: 'ganesh-chaturthi', month: 5, tithi: S(4), anchor: 'madhyahna' },
  { id: 'ghatasthapana', month: 6, tithi: S(1), anchor: 'forenoon' },
  { id: 'fulpati', month: 6, tithi: S(7), anchor: 'purvahna' },
  { id: 'maha-ashtami', month: 6, tithi: S(8), anchor: 'sunrise' },
  { id: 'maha-navami', month: 6, tithi: S(9), anchor: 'madhyahna' },
  { id: 'vijaya-dashami', month: 6, tithi: S(10), anchor: 'aparahna' },
  { id: 'kojagrat-purnima', month: 6, tithi: PURNIMA, anchor: 'nishita' },
  { id: 'dhanteras', month: 6, tithi: K(13), anchor: 'pradosh' },
  { id: 'naraka-chaturdashi', month: 6, tithi: K(14), anchor: 'arunodaya' },
  { id: 'diwali', month: 6, tithi: AMAVASYA, anchor: 'pradosh' },
  { id: 'govardhan-puja', month: 7, tithi: S(1), anchor: 'purvahna' },
  { id: 'bhai-dooj', month: 7, tithi: S(2), anchor: 'aparahna', pick: 'max' },
  { id: 'chhath-puja', month: 7, tithi: S(6), anchor: 'pradosh' },
  { id: 'kartik-purnima', month: 7, tithi: PURNIMA, anchor: 'sunrise' },
  { id: 'basant-panchami', month: 10, tithi: S(5), anchor: 'purvahna' },
];

// Easter Sunday (Gregorian), anonymous algorithm
export function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [year, month, day];
}
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Fixed-date and BS-calendar events
export function fixedEvents(year) {
  const ev = [
    { id: 'new-year', date: iso(year, 1, 1) },
    { id: 'netaji-jayanti', date: iso(year, 1, 23) },
    { id: 'republic-day', date: iso(year, 1, 26) },
    { id: 'labour-day', date: iso(year, 5, 1) },
    { id: 'independence-day', date: iso(year, 8, 15) },
    { id: 'gandhi-jayanti', date: iso(year, 10, 2) },
    { id: 'christmas', date: iso(year, 12, 25) },
  ];
  const [ey, em, ed] = easter(year);
  const easterUtc = Date.UTC(ey, em - 1, ed);
  const fmt = (ms) => { const x = new Date(ms); return iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); };
  ev.push({ id: 'good-friday', date: fmt(easterUtc - 2 * 86400e3) });
  ev.push({ id: 'easter', date: fmt(easterUtc) });
  return ev;
}

export function buildYear(year) {
  const moons = newMoons(new Date(Date.UTC(year - 1, 9, 1)), new Date(Date.UTC(year + 1, 2, 1)));
  const days = [];
  const raws = [];
  for (let m = 1; m <= 12; m++) {
    const dim = new Date(Date.UTC(year, m, 0)).getUTCDate();
    for (let d = 1; d <= dim; d++) {
      const { rec, raw } = computeDay(year, m, d, moons);
      days.push(rec);
      raws.push(raw);
    }
  }

  const events = [];
  const notes = [];


  // Nepali New Year (Baisakh 1, BS calendar) falls on the BS conversion table
  days.forEach((r) => {
    if (r.bs[1] === 1 && r.bs[2] === 1) events.push({ id: 'nepali-new-year', date: r.d });
  });

  // Makar Sankranti (Maghe Sankranti): the Sun enters sidereal Makara (270 deg). Observed on that
  // civil day if the entry is before sunset, otherwise the next day (Drik punya-kaal convention).
  {
    const g = (d) => ((sidSun(d) - 270 + 540) % 360) - 180;
    let a = new Date(Date.UTC(year, 0, 6)), b = new Date(Date.UTC(year, 0, 24));
    for (let i = 0; i < 40; i++) { const m = new Date((a.getTime() + b.getTime()) / 2); if (g(m) < 0) a = m; else b = m; }
    const ist = new Date(b.getTime() + IST * 60000);
    const y0 = ist.getUTCFullYear(), m0 = ist.getUTCMonth() + 1, d0 = ist.getUTCDate();
    const sunset = search(Astronomy.Body.Sun, -1, new Date(midnightIST(y0, m0, d0)));
    const when = b <= sunset ? new Date(Date.UTC(y0, m0 - 1, d0)) : new Date(Date.UTC(y0, m0 - 1, d0 + 1));
    events.push({ id: 'makar-sankranti', date: iso(when.getUTCFullYear(), when.getUTCMonth() + 1, when.getUTCDate()) });
  }

  // does tithi `idx` (in lunar month `month`, non-adhik) overlap the window at any sampled minute?
  const overlaps = (rule, i) => {
    const [a, b] = WINDOWS[rule.anchor](raws[i]);
    let found = null, n = 0;
    for (let t = a.getTime(); t <= b.getTime() + 1; t += 5 * 60000) {
      const d = new Date(t);
      const mo = monthAt(moons, d);
      if (mo && !mo.adhik && mo.month === rule.month && tithiAt(d) === rule.tithi) { found = mo; n++; }
    }
    return found && { mo: found, n };
  };

  const byId = {};
  for (const rule of LUNAR_FESTIVALS) {
    if (rule.after) continue;
    const groups = new Map(); // month occurrence -> { i: chosen day index, n: overlap samples }
    days.forEach((r, i) => {
      const hit = overlaps(rule, i);
      if (!hit) return;
      const key = hit.mo.t.getTime();
      const cur = groups.get(key);
      if (!cur || rule.pick === 'last' || (rule.pick === 'max' && hit.n > cur.n)) groups.set(key, { i, n: hit.n });
    });
    // kshaya: the tithi never touches the window in some month occurrence (e.g. it starts just after sunrise and
    // ends before the next one). Observe it on the first day in which the tithi occurs at all.
    for (const mo of moons) {
      if (mo.adhik || mo.month !== rule.month || groups.has(mo.t.getTime())) continue;
      const end = moons.find((x) => x.t > mo.t)?.t;
      if (!end) continue;
      const i = days.findIndex((r, k) => raws[k].sunrise >= addH(mo.t, -24) && raws[k].sunrise < end && r.t.some(([ti]) => ti === rule.tithi));
      if (i >= 0) { groups.set(mo.t.getTime(), { i, n: 0 }); notes.push(`${rule.id}: tithi never at ${rule.anchor}; used first day it occurs (${days[i].d})`); }
    }
    const forced = OVERRIDES[year]?.[rule.id];
    if (forced) { forced.forEach((dt) => { events.push({ id: rule.id, date: dt }); (byId[rule.id] = byId[rule.id] || []).push(dt); }); continue; }
    for (const [, { i }] of groups) {
      events.push({ id: rule.id, date: days[i].d });
      (byId[rule.id] = byId[rule.id] || []).push(days[i].d);
    }
    if (!byId[rule.id]) notes.push(`${rule.id}: no day found in ${year}`);
  }
  for (const rule of LUNAR_FESTIVALS) {
    if (!rule.after) continue;
    for (const dt of byId[rule.after] || []) {
      const x = new Date(Date.parse(dt + 'T00:00:00Z') + 86400e3);
      events.push({ id: rule.id, date: iso(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()) });
    }
  }
  events.push(...fixedEvents(year));
  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));

  // lunar-month list for the year (for adhik info on the page)
  const months = moons
    .filter((m) => m.t >= new Date(Date.UTC(year, 0, 1)) && m.t < new Date(Date.UTC(year + 1, 0, 1)))
    .map((m) => ({ start: new Date(m.t.getTime() + IST * 60000).toISOString().slice(0, 16), month: m.month, adhik: m.adhik ? 1 : 0 }));

  return { year, place: PLACE.name, days, events, months, notes };
}

