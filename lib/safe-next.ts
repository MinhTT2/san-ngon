/** Only navigate to local paths after authentication. */
export function safeNext(raw: string | null): string {
  if (!raw?.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(raw)) return '/';
  return raw;
}

/** Carry the same validated return path through every authentication page. */
export function authHref(path: '/dang-nhap' | '/dang-ky' | '/quen-mat-khau' | '/dat-lai-mat-khau', next: string): string {
  return `${path}?next=${encodeURIComponent(safeNext(next))}`;
}
