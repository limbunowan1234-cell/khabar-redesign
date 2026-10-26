// lib/adConfig.ts
// Ad placements config. `active: false` on a placement is the master
// kill switch -- AdSlot.tsx refuses to render anything for a campaign
// unless this AND the D1 ad_campaigns row (see cloudflare/src/routes/
// ads.ts) both say active.
//
// Currently running two in-house community appeals (not paid advertisers):
// the Bring Anmol Home appeal in the hero banner and the Raunak fundraiser
// in the sidebar. To turn either off without a deploy, set `active = 0` on
// its row ('bring-anmol-home-2026' / 'raunak-fundraiser-2026') in D1's
// ad_campaigns; to retire it for good, delete its entry below.
//
// The earlier campaign this system was built for (Subha Enterprise
// Consultant LLP, Russia warehouse jobs) was removed: eMigrate's own
// Recruiting Agent registry (the legal requirement under the Emigration
// Act, 1983 to recruit Indians for overseas jobs) has no record of them,
// and their listed website doesn't resolve. Any future third-party
// advertiser goes through the same steps: add an entry to AD_PLACEMENTS,
// insert its D1 ad_campaigns row, flip both `active` flags once verified.
//
// Two homepage slots are wired up in app/HomeClient.tsx:
// homepageHeroBanner, homepageSidebar. This site also has no "jobs"
// section, so a jobsFeaturedCard/jobsGridCard/jobsSectionBanner-style
// placement would need a page to live on first -- a separate product
// decision this file doesn't make on its own.

export interface AdPlacement {
  id: string;
  campaignId: string;
  advertiser: string;
  active: boolean;
  // A placement carries exactly one kind of creative: flat images (what a
  // third-party advertiser supplies, one per viewport width) or a native
  // card rendered as real HTML (headline, body, call to action, optional
  // photo) -- the latter suits an in-house campaign with no designed
  // banner artwork, and stays crisp at any width.
  images?: { desktop: string; tablet: string; mobile: string };
  card?: { image?: string; headline: string; body: string; cta: string };
  href: string;
  alt: string;
  // Small tag shown above the creative. Defaults to "Advertisement"; an
  // in-house fundraiser isn't one, so it says what it actually is.
  label?: string;
}

// Copy is lifted from what the /raunak-fundraiser page itself already
// publishes (its metadata description and Open Graph text) -- nothing
// here claims anything the page doesn't.
const RAUNAK_CARD = {
  image: '/assets/fundraiser/raunak/raunak-before.jpg',
  headline: 'Help Save 2-Year-Old Raunak',
  body: 'Raunak Chettri from Kalimpong is fighting a rare brain tumour at CMC Vellore. Every share and every rupee brings him closer to the treatment he needs.',
  cta: 'How you can help',
};

// Copy follows the appeal published by Darjeeling Maato Ko Maya Foundation
// on the /bring-anmol-home page.
const ANMOL_CARD = {
  image: '/assets/fundraiser/anmol/anmol-face.jpg',
  headline: 'Bring Anmol Home · अनमोललाई घर फर्काऔँ',
  body: 'Anmol Sinchury from Mirik is trapped in a scam company on the Thailand–Myanmar border and has been beaten and tortured. Help bring him home safely.',
  cta: 'How you can help',
};

export const AD_PLACEMENTS: Record<string, AdPlacement> = {
  homepageHeroBanner: {
    id: 'homepage-hero-banner',
    campaignId: 'bring-anmol-home-2026',
    advertiser: 'Darjeeling Maato Ko Maya Foundation (community appeal)',
    active: true,
    card: ANMOL_CARD,
    href: '/bring-anmol-home',
    alt: 'Anmol Sinchury, with bruising around his eyes',
    label: 'Urgent appeal',
  },
  homepageSidebar: {
    id: 'homepage-sidebar',
    campaignId: 'raunak-fundraiser-2026',
    advertiser: 'Khabar Darjeeling (community fundraiser)',
    active: true,
    card: RAUNAK_CARD,
    href: '/raunak-fundraiser',
    alt: 'Raunak, a smiling toddler',
    label: 'Fundraiser',
  },
};
