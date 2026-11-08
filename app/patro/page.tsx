import type { Metadata } from 'next';
import PatroView, { currentIstMonth, monthMetadata, ymSlug } from './view';

// The current month changes at midnight IST; rebuild at least hourly.
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const { year, month } = currentIstMonth();
  return monthMetadata(year, month, ymSlug(year, month));
}

export default function PatroPage() {
  const { year, month } = currentIstMonth();
  return <PatroView year={year} month={month} />;
}
