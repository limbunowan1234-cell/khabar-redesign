import data from '@/data/stays.json';

// Hand-checked listings. Every phone, email and link in data/stays.json was read from the property's
// own website on the date in `checked`. Add a stay only after checking it the same way.
/** Openly licensed photo (Wikimedia Commons); the card shows the author and licence. */
export interface StayPhoto {
  src: string;
  alt: string;
  caption?: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}
/** A rate the property itself published, with the dates it applied to. Never estimated. */
export interface StayPricing {
  summary: string;
  detail: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string;
  sourceUrl: string;
}

/**
 * A guest score and hotel star class copied from a booking site's own page (its schema.org
 * aggregateRating), with the date it was read. Never averaged across sites or estimated.
 */
export interface StayRating {
  source: string;
  score: number;
  outOf: number;
  reviews: number;
  hotelClass?: number; // the booking site's star category, 1 to 5
  url: string;
  checked: string; // YYYY-MM-DD
}

export const REGIONS = [
  { id: 'darjeeling', label: 'Darjeeling', blurb: 'The Queen of the Hills: heritage hotels on the ridge and tea estates below it.' },
  { id: 'kurseong', label: 'Kurseong', blurb: 'The land of white orchids, halfway up the hill road, among the tea gardens.' },
  { id: 'kalimpong', label: 'Kalimpong', blurb: 'A quieter hill town above the Teesta, known for its colonial bungalows and nurseries.' },
  { id: 'mirik', label: 'Mirik', blurb: 'A lake town ringed by pine forest and tea, an easy day from Darjeeling or Siliguri.' },
  { id: 'siliguri', label: 'Siliguri', blurb: 'The gateway to the hills, close to Bagdogra airport and New Jalpaiguri station.' },
  { id: 'sikkim', label: 'Sikkim', blurb: 'Gangtok and beyond, with views of Kanchenjunga.' },
] as const;
export type Region = (typeof REGIONS)[number]['id'];

export interface Stay {
  id: string;
  name: string;
  region: Region;
  group: 'heritage' | 'resort' | 'local';
  area: string;
  tag: string;
  blurb: string;
  facts: string[];
  website: string;
  phones: string[];
  email: string | null;
  mapQuery: string;
  bookingUrl?: string;
  photo?: StayPhoto;
  pricing?: StayPricing;
  rating?: StayRating;
  checked?: string; // set when this stay was checked on a later date than the file-wide `checked`
}
export const STAYS = (data as unknown as { stays: Stay[] }).stays;
export const STAYS_CHECKED = (data as unknown as { checked: string }).checked;
