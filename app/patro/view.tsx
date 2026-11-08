import type { Metadata } from 'next';
import SiteFooter from '@/components/SiteFooter';
import { allEvents, allMonths, currentIstMonth, getMonth, hasMonth, ymSlug } from '@/lib/patro/data';
import { GREG_MONTHS } from '@/lib/patro/names';
import PatroClient from './PatroClient';

export const SITE = 'https://khabardarjeeling.in';

export function monthMetadata(year: number, month: number, canonicalSlug: string): Metadata {
  const name = `${GREG_MONTHS[month - 1][0]} ${year}`;
  const title = `Darjeeling Calendar ${name} - Panchang, Tithi and Festivals`;
  const description = `${name} calendar for Darjeeling: daily tithi, nakshatra, sunrise and sunset, Rahu Kaal, festivals and holidays, with Nepali (BS) dates alongside. In English and Nepali.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/patro/${canonicalSlug}` },
    openGraph: { title: `${title} | Khabar Darjeeling`, description, url: `${SITE}/patro/${canonicalSlug}`, siteName: 'Khabar Darjeeling', type: 'website' },
  };
}

export default function PatroView({ year, month }: { year: number; month: number }) {
  const slugs = allMonths().map((m) => ymSlug(m.year, m.month));
  const i = slugs.indexOf(ymSlug(year, month));
  const cur = currentIstMonth();
  return (
    <>
      <PatroClient
        year={year}
        month={month}
        days={getMonth(year, month)}
        events={allEvents()}
        prev={i > 0 ? slugs[i - 1] : null}
        next={i >= 0 && i < slugs.length - 1 ? slugs[i + 1] : null}
        current={ymSlug(cur.year, cur.month)}
        slugs={slugs}
      />
      <SiteFooter />
    </>
  );
}

export { hasMonth, currentIstMonth, allMonths, ymSlug };
