import 'server-only';
import { createSign } from 'node:crypto';
import { unstable_cache } from 'next/cache';
import { analyticsPage, DISCOVERY_EVENTS } from './analytics';

export type TrafficPeriod = 7 | 30 | 90;
type Failure = 'not_configured' | 'permission' | 'quota' | 'unavailable';
export type TrafficSummary = {
  users: number; views: number; sessions: number; engagement_seconds: number; average_seconds: number;
  new_users: number; engaged_sessions: number; engagement_rate: number; bounce_rate: number; views_per_session: number;
};
type Count = { name: string; value: number };
export type TrafficReport = {
  fetched_at: string; time_zone: string; limited: boolean;
  summary: TrafficSummary; previous: TrafficSummary;
  daily: { date: string; views: number; users: number }[];
  channels: { name: string; sessions: number }[];
  devices: { name: string; users: number }[];
  pages: { path: string; title: string; views: number }[] | null;
  sources: Count[] | null; landing: Count[] | null; countries: Count[] | null; cities: Count[] | null;
  browsers: Count[] | null; systems: Count[] | null; languages: Count[] | null; hours: Count[] | null;
  audiences: Count[] | null; events: Count[] | null;
  partial: string[];
};
export type TrafficResult = { status: 'ready'; report: TrafficReport } | { status: Failure };
export type RealtimeResult = { status: 'ready'; users: number; fetched_at: string } | { status: Failure };
type Row = { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] };
type Report = { rows?: Row[]; metadata?: { timeZone?: string; subjectToThresholding?: boolean; dataLossFromOtherRow?: boolean; samplingMetadatas?: unknown[] } };
type Metric = string | { name: string; expression: string };
class GoogleReportError extends Error {
  constructor(public category: Exclude<Failure, 'not_configured'>) { super(category); }
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
  if (!row) return 0;
  const raw = row.metricValues?.[index]?.value;
  if (typeof raw !== 'string' || !raw.trim()) throw new GoogleReportError('unavailable');
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new GoogleReportError('unavailable');
  return value;
};
const dimension = (row: Row, index = 0) => row.dimensionValues?.[index]?.value ?? '';
const summaryMetrics: Metric[] = ['activeUsers', 'screenPageViews', 'sessions', 'userEngagementDuration',
  { name: 'averageEngagementTimePerUser', expression: 'userEngagementDuration/activeUsers' },
  'newUsers', 'engagedSessions', 'engagementRate', 'bounceRate', 'screenPageViewsPerSession'];
function summary(report: Report): TrafficSummary {
  const row = report.rows?.[0];
  const values = summaryMetrics.map((_, index) => metric(row, index));
  if (values[7] > 1 || values[8] > 1) throw new GoogleReportError('unavailable');
  return { users: values[0], views: values[1], sessions: values[2], engagement_seconds: values[3], average_seconds: values[4],
    new_users: values[5], engaged_sessions: values[6], engagement_rate: values[7], bounce_rate: values[8], views_per_session: values[9] };
}
function validateReport(report: Report) {
  if (!report || typeof report !== 'object' || (report.rows !== undefined && !Array.isArray(report.rows))) throw new GoogleReportError('unavailable');
  for (const row of report.rows ?? []) {
    if (!row || !Array.isArray(row.metricValues) || row.metricValues.length === 0) throw new GoogleReportError('unavailable');
    if (row.dimensionValues !== undefined && (!Array.isArray(row.dimensionValues) || row.dimensionValues.some(item => typeof item?.value !== 'string'))) throw new GoogleReportError('unavailable');
    row.metricValues.forEach((_, i) => metric(row, i));
  }
  return report;
}

const readReport = unstable_cache(async (property: string, days: TrafficPeriod, email: string): Promise<TrafficReport> => {
  const bearer = await accessToken(email, process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'));
  const headers = { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' };
  const request = (dimensions: string[], metrics: Metric[], limit = 20, previous = false) => ({
    dateRanges: [{ startDate: `${previous ? days * 2 - 1 : days - 1}daysAgo`, endDate: previous ? `${days}daysAgo` : 'today' }],
    dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(item => typeof item === 'string' ? { name: item } : item), limit,
    ...(dimensions[0] === 'date' || dimensions[0] === 'hour' ? { orderBys: [{ dimension: { dimensionName: dimensions[0] } }] }
      : dimensions.length ? { orderBys: [{ metric: { metricName: typeof metrics[0] === 'string' ? metrics[0] : metrics[0].name }, desc: true }] } : {}),
  });
  async function batch(requests: (ReturnType<typeof request> & { dimensionFilter?: unknown })[]) {
    const data = await googleJson(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:batchRunReports`, {
      method: 'POST', headers, body: JSON.stringify({ requests }),
    });
    if (!Array.isArray(data.reports) || data.reports.length !== requests.length) throw new GoogleReportError('unavailable');
    return (data.reports as Report[]).map((report, index) => {
      validateReport(report);
      if (report.rows?.some(row => row.metricValues?.length !== requests[index].metrics.length || (row.dimensionValues?.length ?? 0) !== requests[index].dimensions.length)) throw new GoogleReportError('unavailable');
      return report;
    });
  }
  const core = await batch([
    request([], summaryMetrics), request([], summaryMetrics, 20, true),
    request(['date'], ['screenPageViews', 'activeUsers'], days),
    request(['sessionDefaultChannelGroup'], ['sessions']), request(['deviceCategory'], ['activeUsers']),
  ]);
  const current = summary(core[0]), previous = summary(core[1]);
  // GA accepts five reports per batch, ten metrics per report. Optional groups fail independently.
  const groups = await Promise.allSettled([
    batch([request(['pagePath'], ['screenPageViews']), request(['sessionSourceMedium'], ['sessions']),
      request(['landingPage'], ['sessions']), request(['country'], ['activeUsers']), request(['city'], ['activeUsers'])]),
    batch([request(['browser'], ['activeUsers']), request(['operatingSystem'], ['activeUsers']),
      request(['language'], ['activeUsers']), request(['hour'], ['sessions'], 24), request(['newVsReturning'], ['sessions'])]),
    batch([{ ...request(['eventName'], ['eventCount']), dimensionFilter: { filter: {
      fieldName: 'eventName', inListFilter: { values: Object.keys(DISCOVERY_EVENTS), caseSensitive: true },
    } } }]),
  ]);
  const get = (group: number, index: number): Report | null => {
    const result = groups[group];
    return result.status === 'fulfilled' ? result.value[index] : null;
  };
  const counts = (report: Report | null): Count[] | null => report && (report.rows ?? []).map(row => ({ name: dimension(row) || '(not set)', value: metric(row, 0) }));
  const pageCounts = (report: Report | null) => report && (report.rows ?? []).flatMap(row => {
    const path = dimension(row), page = analyticsPage(path);
    return page ? [{ path, title: page.page_title, views: metric(row, 0) }] : [];
  });
  const landing = pageCounts(get(0, 2));
  const all = [...core, ...groups.flatMap(result => result.status === 'fulfilled' ? result.value : [])];
  return {
    fetched_at: new Date().toISOString(), time_zone: core[0].metadata?.timeZone ?? '',
    limited: all.some(item => !!(item.metadata?.subjectToThresholding || item.metadata?.dataLossFromOtherRow || item.metadata?.samplingMetadatas?.length)),
    summary: current, previous,
    daily: (core[2].rows ?? []).map(row => ({ date: dimension(row), views: metric(row, 0), users: metric(row, 1) })),
    channels: (core[3].rows ?? []).map(row => ({ name: dimension(row), sessions: metric(row, 0) })),
    devices: (core[4].rows ?? []).map(row => ({ name: dimension(row), users: metric(row, 0) })),
    pages: pageCounts(get(0, 0)), sources: counts(get(0, 1)), landing: landing?.map(row => ({ name: row.path, value: row.views })) ?? null,
    countries: counts(get(0, 3)), cities: counts(get(0, 4)), browsers: counts(get(1, 0)), systems: counts(get(1, 1)),
    languages: counts(get(1, 2)), hours: counts(get(1, 3)), audiences: counts(get(1, 4)),
    events: counts(get(2, 0))?.filter(row => Object.hasOwn(DISCOVERY_EVENTS, row.name)) ?? null,
    partial: groups.flatMap((result, index) => result.status === 'rejected' ? [['Trang và nguồn truy cập', 'Thiết bị và thói quen truy cập', 'Thao tác khám phá sân'][index]] : []),
  };
}, ['ga4-traffic-report-v2'], { revalidate: 600 });

const readRealtime = unstable_cache(async (property: string, email: string) => {
  const bearer = await accessToken(email, process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'));
  const data = validateReport(await googleJson(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runRealtimeReport`, {
    method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ metrics: [{ name: 'activeUsers' }], minuteRanges: [{ startMinutesAgo: 29, endMinutesAgo: 0 }] }),
  }));
  return { users: metric(data.rows?.[0], 0), fetched_at: new Date().toISOString() };
}, ['ga4-realtime-v1'], { revalidate: 60 });

function config() {
  const property = process.env.GA4_PROPERTY_ID?.trim(), email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  return property && /^\d+$/.test(property) && email && /^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(email)
    && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim() ? { property, email } : null;
}
const failure = (error: unknown) => error instanceof GoogleReportError ? error.category : 'unavailable';

/** Caller must check the current admin session before accessing these cached reports. */
export async function getGa4Report(days: TrafficPeriod): Promise<TrafficResult> {
  const settings = config();
  if (!settings) return { status: 'not_configured' };
  try { return { status: 'ready', report: await readReport(settings.property, days, settings.email) }; }
  catch (error) { return { status: failure(error) }; }
}
export async function getGa4Realtime(): Promise<RealtimeResult> {
  const settings = config();
  if (!settings) return { status: 'not_configured' };
  try { return { status: 'ready', ...await readRealtime(settings.property, settings.email) }; }
  catch (error) { return { status: failure(error) }; }
}
