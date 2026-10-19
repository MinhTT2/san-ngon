export const ANALYTICS_ORIGIN = 'https://san-ngon.vercel.app';

const PUBLIC_PAGE_TITLES: Record<string, string> = {
  '/': 'Trang chủ',
  '/tim-san': 'Tìm sân',
  '/giai-dau': 'Giải đấu',
  '/ket-noi': 'Kết nối',
  '/lien-he': 'Liên hệ',
  '/chinh-sach-huy': 'Chính sách hủy',
  '/tro-giup': 'Trợ giúp',
  '/quyen-rieng-tu': 'Quyền riêng tư',
  '/dieu-khoan-su-dung': 'Điều khoản sử dụng',
  '/nguon-hinh-anh': 'Nguồn hình ảnh',
};

export function productionAnalyticsId(environment: string | undefined, measurementId: string | undefined) {
  const id = measurementId?.trim();
  return environment === 'production' && id && /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

/** An explicit allowlist keeps new account/management routes private by default. */
export function analyticsPage(pathname: string) {
  const title = Object.hasOwn(PUBLIC_PAGE_TITLES, pathname) ? PUBLIC_PAGE_TITLES[pathname]
    : /^\/san\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pathname) ? 'Chi tiết sân' : null;
  return title ? { page_location: `${ANALYTICS_ORIGIN}${pathname}`, page_title: `${title} — Sân Ngon` } : null;
}

/** Referrers retain their source, without searches, tokens or private route identifiers. */
export function analyticsReferrer(value: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    return url.origin === ANALYTICS_ORIGIN && analyticsPage(url.pathname)
      ? `${url.origin}${url.pathname}` : `${url.origin}/`;
  } catch {
    return '';
  }
}
