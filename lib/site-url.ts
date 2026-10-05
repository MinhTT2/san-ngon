export function siteUrl(path = '/') {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://san-ngon.vercel.app';
  return new URL(path, origin);
}

export const PRIVATE_ROUTE_PREFIXES = [
  '/admin', '/chu-san', '/tao-cum-san', '/dat-san', '/don-cua-toi',
  '/tai-khoan', '/thong-bao', '/dang-nhap', '/dang-ky', '/dang-ky-san',
  '/quen-mat-khau', '/dat-lai-mat-khau', '/giai-dau/tao', '/ket-noi/ho-so',
  '/api', '/auth',
];
