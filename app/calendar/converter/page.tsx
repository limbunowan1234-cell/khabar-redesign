import type { Metadata } from 'next';
import SiteFooter from '@/components/SiteFooter';
import ConverterClient from './ConverterClient';

const SITE = 'https://khabardarjeeling.in';

export const metadata: Metadata = {
  title: 'Nepali Date Converter - AD to BS and BS to AD',
  description: 'Convert English (AD) dates to Nepali Bikram Sambat (BS) dates and back, with the weekday and a link to that day\'s tithi and festivals. In English and Nepali.',
  alternates: { canonical: SITE + '/calendar/converter' },
  openGraph: {
    title: 'Nepali Date Converter - AD to BS and BS to AD | Khabar Darjeeling',
    description: 'Convert AD dates to Bikram Sambat (BS) and back.',
    url: SITE + '/calendar/converter',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default function ConverterPage() {
  return (
    <>
      <ConverterClient />
      <SiteFooter />
    </>
  );
}
