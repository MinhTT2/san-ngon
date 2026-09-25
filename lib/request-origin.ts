/** Next's internal listen address can differ from the browser-facing Host. */
export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${request.headers.get('host') ?? url.host}`;
}
