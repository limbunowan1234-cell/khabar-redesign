// lib/adConfig.ts
// Ad placements config. `active: false` on the campaign is the master
// kill switch -- AdSlot.tsx refuses to render anything for a campaign
// unless this AND the D1 ad_campaigns row (see cloudflare/src/routes/
// ads.ts) both say active. Flip both to true only once the advertiser's
// license has been verified and real creative images are in place.
//
// Only 2 of the 5 placements from the original spec are wired up here:
// homepageHeroBanner and homepageSidebar, because this site doesn't have
// a "jobs" section for the other 3 (jobsFeaturedCard, jobsGridCard,
// jobsSectionBanner) to live on -- that's a separate product decision
// (add a whole new page/section) this file doesn't make on its own.
// Their configs are included below, commented, ready to uncomment and
// point at real placements once that page exists.

export interface AdPlacement {
  id: string;
  campaignId: string;
  advertiser: string;
  active: boolean;
  images: { desktop: string; tablet: string; mobile: string };
  href: string;
  alt: string;
}

export const AD_CAMPAIGN_ID = 'subha-russia-jobs-001';

export const AD_PLACEMENTS: Record<string, AdPlacement> = {
  homepageHeroBanner: {
    id: 'homepage-hero-banner',
    campaignId: AD_CAMPAIGN_ID,
    advertiser: 'Subha Enterprise Consultant LLP',
    active: false,
    images: {
      desktop: '/ads/subha-russia-jobs/hero-banner/desktop.jpg',
      tablet: '/ads/subha-russia-jobs/hero-banner/tablet.jpg',
      mobile: '/ads/subha-russia-jobs/hero-banner/mobile.jpg',
    },
    href: 'https://wa.me/918597772969',
    alt: 'Subha Enterprise Consultant LLP — Warehouse jobs in Moscow, Russia',
  },
  homepageSidebar: {
    id: 'homepage-sidebar',
    campaignId: AD_CAMPAIGN_ID,
    advertiser: 'Subha Enterprise Consultant LLP',
    active: false,
    images: {
      desktop: '/ads/subha-russia-jobs/sidebar/desktop.jpg',
      tablet: '/ads/subha-russia-jobs/sidebar/tablet.jpg',
      mobile: '/ads/subha-russia-jobs/sidebar/mobile.jpg',
    },
    href: 'https://wa.me/918597772969',
    alt: 'Subha Enterprise Consultant LLP — Warehouse jobs in Moscow, Russia',
  },

  // -- Not wired to a page yet; this site has no /jobs section. --
  // jobsFeaturedCard: { id: 'jobs-featured-card', ... },
  // jobsGridCard: { id: 'jobs-grid-item', ... },
  // jobsSectionBanner: { id: 'jobs-section-banner', ... },
};
