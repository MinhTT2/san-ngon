import type { NextConfig } from 'next';
import { PRIVATE_ROUTE_PREFIXES } from './lib/site-url';

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
      { protocol: 'https', hostname: 'qr.sepay.vn' },
      { protocol: 'https', hostname: 'cdn.vietqr.io' },
    ],
  },
};

export default nextConfig;
