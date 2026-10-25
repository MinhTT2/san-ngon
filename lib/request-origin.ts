/** Next's internal listen address can differ from the browser-facing Host. */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${request.headers.get('host') ?? url.host}`;
}

/** Cookie-authenticated writes must come from the website itself.
 * Webhooks and the scheduler authenticate independently at their exact paths.
 * Never trust Origin-like forwarding headers supplied by the caller.
 */
export function isAllowedWriteRequest(request: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const path = new URL(request.url).pathname;
  if (request.method === 'POST' && ['/api/webhooks/sepay', '/api/webhooks/telegram', '/api/sepay/notifications'].includes(path)) return true;
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try {
    const parsed = new URL(origin);
    // An Origin is just a scheme + host + port, with no credentials or path.
    return origin === parsed.origin && origin === requestOrigin(request);
  } catch {
    return false;
  }
}
