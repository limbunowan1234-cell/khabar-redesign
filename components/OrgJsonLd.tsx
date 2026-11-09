const SITE = 'https://khabardarjeeling.in';

// Organization + WebSite structured data. The policy URLs point at pages that already exist
// (editorial guidelines, code of ethics with its corrections section, grievance redressal).
const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'NewsMediaOrganization',
      '@id': SITE + '/#organization',
      name: 'Khabar Darjeeling',
      url: SITE,
      logo: { '@type': 'ImageObject', url: SITE + '/assets/logo.png' },
      description: 'Local news for Darjeeling, Kalimpong, Kurseong, Mirik and the Gorkha community.',
      sameAs: [
        'https://www.facebook.com/profile.php?id=61590708777947',
        'https://www.instagram.com/khabardarjeeling_2026',
        'https://whatsapp.com/channel/0029VbD933y3LdQQ0g9Z682b',
      ],
      parentOrganization: { '@type': 'Organization', name: 'Darjeeling Web Studio' },
      publishingPrinciples: SITE + '/editorial-guidelines',
      ethicsPolicy: SITE + '/code-of-ethics',
      correctionsPolicy: SITE + '/code-of-ethics',
      actionableFeedbackPolicy: SITE + '/grievance',
      contactPoint: { '@type': 'ContactPoint', contactType: 'editorial', url: SITE + '/contact' },
    },
    {
      '@type': 'WebSite',
      '@id': SITE + '/#website',
      url: SITE,
      name: 'Khabar Darjeeling',
      publisher: { '@id': SITE + '/#organization' },
    },
  ],
};

export default function OrgJsonLd() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}
