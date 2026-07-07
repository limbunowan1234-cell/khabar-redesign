import type { Metadata } from 'next';
import ContestClient from './ContestClient';

export const metadata: Metadata = {
  title: 'Story Contest 2026',
  description: 'Enter the Khabar Darjeeling Story Contest 2026. Share your stories from Darjeeling and the Gorkha community for a chance to win prizes.',
  alternates: { canonical: 'https://khabardarjeeling.space/contest' },
  openGraph: {
    title: 'Story Contest 2026 | Khabar Darjeeling',
    description: 'Enter the Khabar Darjeeling Story Contest 2026. Share your stories from Darjeeling and the Gorkha community.',
    url: 'https://khabardarjeeling.space/contest',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default function Page() {
  return <ContestClient />;
}