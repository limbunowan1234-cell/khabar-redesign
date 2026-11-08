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

export interface Stay {
  id: string;
  name: string;
  group: 'heritage' | 'local';
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
}
export const STAYS = (data as unknown as { stays: Stay[] }).stays;
export const STAYS_CHECKED = (data as unknown as { checked: string }).checked;
