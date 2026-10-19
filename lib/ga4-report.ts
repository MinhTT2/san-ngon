import 'server-only';
import { createSign } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { analyticsPage } from './analytics';

export type TrafficPeriod = 7 | 30 | 90;
export type TrafficReport = {
  fetched_at: string; time_zone: string;
  summary: { users: number; views: number; sessions: number; engagement_seconds: number; average_seconds: number };
  daily: { date: string; views: number; users: number }[];
  channels: { name: string; sessions: number }[];
  devices: { name: string; users: number }[];
  pages: { path: string; title: string; views: number }[];
};
export type TrafficResult = { status: 'ready'; report: TrafficReport }
  | { status: 'not_configured' | 'permission' | 'quota' | 'unavailable' };

type Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type Report = { rows?: Row[]; metadata?: { timeZone?: string } };
class GoogleReportError extends Error {
  constructor(public category: 'permission' | 'quota' | 'unavailable') { super(category); }
}
let token: { email: string; value: string; expires: number } | null = null;

async function googleJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new GoogleReportError(response.status === 401 || response.status === 403 ? 'permission' : response.status === 429 ? 'quota' : 'unavailable');
  return response.json();
}

async function accessToken(email: string, privateKey: string) {
  if (token?.email === email && token.expires > Date.now()) return token.value;
  const issued = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const content = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: issued, exp: issued + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(content).sign(privateKey, 'base64url');
  const result = await googleJson('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${content}.${signature}` }),
  });
  if (typeof result.access_token !== 'string' || typeof result.expires_in !== 'number') throw new GoogleReportError('unavailable');
  token = { email, value: result.access_token, expires: Date.now() + Math.max(0, result.expires_in - 60) * 1000 };
  return token.value;
}

const metric = (row: Row | undefined, index: number) => {
  const value = Number(row?.metricValues?.[index]?.value ?? 0);
  if (!Number.isFinite(value) || value < 0) throw new GoogleReportError('unavailable');
  return value;
};
const dimension = (row: Row, index = 0) => row.dimensionValues?.[index]?.value ?? '';

const readReport = unstable_cache(async (property: string, days: TrafficPeriod, email: string): Promise<TrafficReport> => {
  const bearer = await accessToken(email, process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'));
  const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];
  const request = (dimensions: string[], metrics: (string | { name: string; expression: string })[], limit?: number) => ({
    dateRanges, dimensions: dimensions.map(name => ({ name })),
    metrics: metrics.map(item => typeof item === 'string' ? { name: item } : item),
    ...(limit ? { limit } : {}),
    ...(dimensions[0] === 'date' ? { orderBys: [{ dimension: { dimensionName: 'date' } }] }
      : dimensions.length ? { orderBys: [{ metric: { metricName: typeof metrics[0] === 'string' ? metrics[0] : metrics[0].name }, desc: true }] } : {}),
  });
  const data = await googleJson(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:batchRunReports`, {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requests: [
      request([], ['activeUsers', 'screenPageViews', 'sessions', 'userEngagementDuration', { name: 'averageEngagementTimePerUser', expression: 'userEngagementDuration/activeUsers' }]),
      request(['date'], ['screenPageViews', 'activeUsers']),
      request(['sessionDefaultChannelGroup'], ['sessions'], 10),
      request(['deviceCategory'], ['activeUsers'], 10),
      request(['pagePath'], ['screenPageViews'], 20),
    ] }),
  });
  if (!Array.isArray(data.reports) || data.reports.length !== 5) throw new GoogleReportError('unavailable');
  const [summary, daily, channels, devices, pages] = data.reports as Report[];
  if (data.reports.some((item: Report) => !item || (item.rows !== undefined && !Array.isArray(item.rows)))) throw new GoogleReportError('unavailable');
  const totals = summary.rows?.[0];
  return {
    fetched_at: new Date().toISOString(), time_zone: summary.metadata?.timeZone ?? '',
    summary: { users: metric(totals, 0), views: metric(totals, 1), sessions: metric(totals, 2), engagement_seconds: metric(totals, 3), average_seconds: metric(totals, 4) },
    daily: (daily.rows ?? []).map(row => ({ date: dimension(row), views: metric(row, 0), users: metric(row, 1) })),
    channels: (channels.rows ?? []).map(row => ({ name: dimension(row), sessions: metric(row, 0) })),
    devices: (devices.rows ?? []).map(row => ({ name: dimension(row), users: metric(row, 0) })),
    pages: (pages.rows ?? []).flatMap(row => {
      const path = dimension(row);
      const page = analyticsPage(path);
      return page ? [{ path, title: page.page_title, views: metric(row, 0) }] : [];
    }),
  };
}, ['ga4-traffic-report-v1'], { revalidate: 600 });

/** Caller must check the current admin session before accessing this cached report. */
export async function getGa4Report(days: TrafficPeriod): Promise<TrafficResult> {
  const property = process.env.GA4_PROPERTY_ID?.trim();
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!property || !/^\d+$/.test(property) || !email || !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(email) || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()) return { status: 'not_configured' };
  try { return { status: 'ready', report: await readReport(property, days, email) }; }
  catch (error) { return { status: error instanceof GoogleReportError ? error.category : 'unavailable' }; }
}
