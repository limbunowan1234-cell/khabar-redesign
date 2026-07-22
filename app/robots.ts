import type { MetadataRoute } from 'next';

const SITE = 'https://khabardarjeeling.in';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/auth', '/bookmarks', '/profile$', '/post'],
      },
    ],
    sitemap: [SITE + '/sitemap.xml', SITE + '/image-sitemap.xml'],
  };
}
