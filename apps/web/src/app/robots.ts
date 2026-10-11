import type { MetadataRoute } from 'next';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://cofounderbay.com';

/**
 * Only the genuinely public surface is crawlable. Everything behind the auth
 * middleware would 302 to /login for a crawler anyway, so disallowing it up
 * front saves crawl budget and keeps member data out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/admin',
          '/tenant',
          '/org',
          '/api/',
          '/auth/',
          '/settings',
          '/messages',
          '/dashboard',
          '/data-room',
          '/share/',
          '/demo',
          '/test-onboarding',
          '/api-status',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
