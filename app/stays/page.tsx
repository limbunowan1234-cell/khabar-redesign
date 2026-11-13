import type { Metadata } from 'next';
import StaysShell from './StaysShell';

const SITE = 'https://khabardarjeeling.in';

export const metadata: Metadata = {
  title: 'Stays in Darjeeling, Kurseong, Kalimpong, Mirik, Siliguri and Sikkim - Hotels with Guest Ratings',
  description: "Find a place to stay in Darjeeling, Kurseong, Kalimpong, Mirik, Siliguri and Sikkim: heritage hotels, tea estates, resorts and hotels, with verified guest ratings and each property's own rates, phone and email. Send an enquiry directly.",
  alternates: { canonical: SITE + '/stays' },
  openGraph: {
    title: 'Stays in Darjeeling, Sikkim and the Hills | Khabar Darjeeling',
    description: 'Heritage hotels, tea estates, resorts and hotels across Darjeeling, Kalimpong, Mirik, Siliguri and Sikkim, with verified guest ratings. Enquire directly with the stay.',
    url: SITE + '/stays',
    siteName: 'Khabar Darjeeling',
    type: 'website',
  },
};

export default function StaysPage() {
  return <StaysShell />;
}
