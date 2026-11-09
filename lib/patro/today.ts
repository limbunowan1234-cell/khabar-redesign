import { allEvents, getMonth, hasMonth } from '@/lib/patro/data';

/** Small "today in Darjeeling" payload for the home page card. Dates are IST; everything comes from the generated panchang. */
export interface TodayPayload {
  date: string; // YYYY-MM-DD (IST)
  wd: number;
  bs: [number, number, number];
  tithi: [number, number]; // [index, end minute] of the tithi running at sunrise
  nakshatra: [number, number];
  lm: number;
  adhik: 0 | 1;
  sr: number;
  ss: number;
  events: string[]; // festival ids today
  upcoming: { id: string; date: string; inDays: number }[];
}

const dayNum = (iso: string) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400e3);

export function todayPayload(now = Date.now()): TodayPayload | null {
  const date = new Date(now + 330 * 60000).toISOString().slice(0, 10);
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  if (!hasMonth(y, m)) return null;
  const day = getMonth(y, m).find((d) => d.d === date);
  if (!day) return null;
  const events = allEvents();
  return {
    date,
    wd: day.wd,
    bs: day.bs,
    tithi: day.t[0],
    nakshatra: day.n[0],
    lm: day.lm,
    adhik: day.adhik,
    sr: day.sr,
    ss: day.ss,
    events: events.filter((e) => e.date === date).map((e) => e.id),
    upcoming: events
      .filter((e) => e.date > date)
      .slice(0, 4)
      .map((e) => ({ id: e.id, date: e.date, inDays: dayNum(e.date) - dayNum(date) })),
  };
}
