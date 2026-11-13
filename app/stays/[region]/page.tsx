import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StaysShell from '../StaysShell';
import { REGIONS, STAYS, type Region } from '@/lib/stays';

const SITE = 'https://khabardarjeeling.in';

// One prerendered page per region, so "hotels in Kalimpong" and the like each have their own URL.
export const dynamicParams = false;
export function generateStaticParams() {
  return REGIONS.map((r) => ({ region: r.id }));
}

const find = (id: string) => REGIONS.find((r) => r.id === id);

export async function generateMetadata({ params }: PageProps<'/stays/[region]'>): Promise<Metadata> {
  const r = find((await params).region);
  if (!r) return {};
  const n = STAYS.filter((s) => s.region === r.id).length;
  const title = `Hotels and Stays in ${r.label} - Heritage Hotels, Resorts and Guest Ratings`;
  const description = `${n} hand-checked places to stay in ${r.label}, with verified guest ratings and each property's own rates, phone and email. ${r.blurb} Enquire directly, no booking fees.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/stays/${r.id}` },
    openGraph: { title: `Stays in ${r.label} | Khabar Darjeeling`, description, url: `${SITE}/stays/${r.id}`, siteName: 'Khabar Darjeeling', type: 'website' },
  };
}

export default async function RegionStaysPage({ params }: PageProps<'/stays/[region]'>) {
  const r = find((await params).region);
  if (!r) notFound();
  return <StaysShell region={r.id as Region} />;
}
