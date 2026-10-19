import type { Metadata } from 'next';
import { siteUrl } from './site-url';

export const DEFAULT_SHARE_IMAGE = {
  url: '/media/share-default.png', width: 1200, height: 630,
  alt: 'Sân Ngon — Tìm sân trống. Chọn giờ, ra sân.',
};

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = siteUrl(path).href;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', locale: 'vi_VN', siteName: 'Sân Ngon', images: [DEFAULT_SHARE_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_SHARE_IMAGE] },
  };
}
