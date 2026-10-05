import type { MetadataRoute } from 'next';
import { PRIVATE_ROUTE_PREFIXES, siteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE_ROUTE_PREFIXES },
    sitemap: siteUrl('/sitemap.xml').href,
  };
}
