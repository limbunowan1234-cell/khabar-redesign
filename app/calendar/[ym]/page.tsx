import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PatroView, { allMonths, hasMonth, monthMetadata, ymSlug } from '../view';

export const dynamicParams = false;

export function generateStaticParams() {
  return allMonths().map((m) => ({ ym: ymSlug(m.year, m.month) }));
}

function parse(ym: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]);
  return hasMonth(year, month) ? { year, month } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ ym: string }> }): Promise<Metadata> {
  const { ym } = await params;
  const p = parse(ym);
  if (!p) return { title: 'Not Found' };
  return monthMetadata(p.year, p.month, ym);
}

export default async function PatroMonthPage({ params }: { params: Promise<{ ym: string }> }) {
  const { ym } = await params;
  const p = parse(ym);
  if (!p) notFound();
  return <PatroView year={p.year} month={p.month} />;
}
