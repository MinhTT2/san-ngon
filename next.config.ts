import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qr.sepay.vn' },
      { protocol: 'https', hostname: 'cdn.vietqr.io' },
    ],
  },
};

export default nextConfig;
