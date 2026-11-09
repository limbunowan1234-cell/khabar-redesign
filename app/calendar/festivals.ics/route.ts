import { allEvents } from '@/lib/patro/data';
import { festivalName } from '@/lib/patro/names';

const SITE = 'https://khabardarjeeling.in';

// RFC 5545 text escaping and 75-octet line folding
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes.encode(cur + ch).length > limit) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const compact = (iso: string) => iso.replace(/-/g, '');
const nextDay = (iso: string) => new Date(Date.parse(iso + 'T00:00:00Z') + 86400e3).toISOString().slice(0, 10);

// Subscribable festival and holiday calendar (webcal://khabardarjeeling.in/calendar/festivals.ics).
// All-day events, no alarms: people add their own reminders in their calendar app.
export async function GET() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Khabar Darjeeling//Darjeeling Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Darjeeling festivals and holidays',
    'X-WR-TIMEZONE:Asia/Kolkata',
    'X-WR-CALDESC:' + esc('Festival and holiday dates for Darjeeling from the Khabar Darjeeling calendar (Indian panchang).'),
  ];
  for (const e of allEvents()) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}-${e.date}@khabardarjeeling.in`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`,
      'SUMMARY:' + esc(festivalName(e.id, 'en')),
      'DESCRIPTION:' + esc(`Date for Darjeeling. Tithi, nakshatra and Nepali (BS) date: ${SITE}/calendar/${e.date.slice(0, 7)}`),
      `URL:${SITE}/calendar/${e.date.slice(0, 7)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.map(fold).join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="darjeeling-festivals.ics"',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
