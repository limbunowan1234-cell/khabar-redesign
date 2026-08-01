import type { Metadata } from 'next';
import BhasaDivasHub from '@/components/bhasa-diwas/BhasaDivasHub';

const SITE = 'https://khabardarjeeling.in';

export const metadata: Metadata = {
  title: 'Nepali Bhasa Diwas 2026 - Poetry, Essay & Photo Contest | Khabar Darjeeling',
  description: 'Celebrate Nepali Language Day. Submit your poetry, essays, and photography for the Nepali Bhasa Diwas contest on Khabar Darjeeling.',
  alternates: { canonical: SITE + '/nepali-bhasa-diwas' },
  openGraph: {
    title: 'Nepali Bhasa Diwas 2026 - Khabar Darjeeling',
    description: 'Celebrate Nepali Language Day. Submit your poetry, essays, and photography.',
    url: SITE + '/nepali-bhasa-diwas',
    siteName: 'Khabar Darjeeling',
    type: 'website',
    images: [{ url: SITE + '/assets/bhasa-diwas-hero.png', width: 1200, height: 630, alt: 'Nepali Bhasa Diwas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nepali Bhasa Diwas 2026 - Khabar Darjeeling',
    description: 'Celebrate Nepali Language Day. Submit your poetry, essays, and photography.',
    images: [SITE + '/assets/bhasa-diwas-hero.png'],
  },
};

export default function BhasaDivasPage() {
  return <BhasaDivasHub />;
}