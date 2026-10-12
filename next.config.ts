import type { NextConfig } from 'next';
import { PRIVATE_ROUTE_PREFIXES } from './lib/site-url';

// Allow only public venue photos from the configured project, never private documents.
const storage = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const venuePhotos = storage && ['https:', 'http:'].includes(storage.protocol) ? [{
  protocol: storage.protocol.slice(0, -1) as 'https' | 'http',
  hostname: storage.hostname, port: storage.port,
  pathname: '/storage/v1/object/public/venue-photos/**', search: '',
}] : [];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return PRIVATE_ROUTE_PREFIXES.map(path => ({
      source: `${path}/:path*`,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
    }));
  },
  images: {
    remotePatterns: [
      ...venuePhotos,
      { protocol: 'https', hostname: 'qr.sepay.vn' },
      { protocol: 'https', hostname: 'cdn.vietqr.io' },
    ],
  },
};

export default nextConfig;
