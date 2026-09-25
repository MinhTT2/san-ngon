/** Only navigate to local paths after authentication. */
export function safeNext(raw: string | null): string {
  if (!raw?.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(raw)) return '/';
  return raw;
}
