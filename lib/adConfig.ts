// lib/adConfig.ts
// Ad placements config. `active: false` on a campaign is the master
// kill switch -- AdSlot.tsx refuses to render anything for a campaign
// unless this AND the D1 ad_campaigns row (see cloudflare/src/routes/
// ads.ts) both say active.
//
// No placements are configured right now -- the one campaign this was
// built for (Subha Enterprise Consultant LLP, Russia warehouse jobs)
// was removed: eMigrate's own Recruiting Agent registry (the legal
// requirement under the Emigration Act, 1983 to recruit Indians for
// overseas jobs) has no record of them, and their listed website
// doesn't resolve. The system itself -- this config, AdSlot.tsx, the
// D1 tables, tracking routes, admin dashboard -- stays in place and
// works exactly the same way for any future, actually-verified
// advertiser: add an entry to AD_PLACEMENTS below, insert its D1
// ad_campaigns row, flip both `active` flags once ready.
//
// Two homepage slots are wired up in app/HomeClient.tsx and will
// render nothing until a placement exists here for them:
// homepageHeroBanner, homepageSidebar. This site also has no "jobs"
// section, so a jobsFeaturedCard/jobsGridCard/jobsSectionBanner-style
// placement would need a page to live on first -- a separate product
// decision this file doesn't make on its own.

export interface AdPlacement {
  id: string;
  campaignId: string;
  advertiser: string;
  active: boolean;
  images: { desktop: string; tablet: string; mobile: string };
  href: string;
  alt: string;
}

export const AD_PLACEMENTS: Record<string, AdPlacement> = {};
