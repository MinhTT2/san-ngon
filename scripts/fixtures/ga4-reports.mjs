// Fixed provider fixtures shared by isolated browser/API checks. No real Google data.
const row = (dimensions, metrics) => ({ dimensionValues: dimensions.map(value => ({ value })), metricValues: metrics.map(value => ({ value: String(value) })) });
export function fixtureReport(request, mode = 'configured') {
  if (mode === 'empty') return {};
  const dimension = request.dimensions?.[0]?.name;
  const rows = {
    date: [row(['20261018'], [2, 1]), row(['20261019'], [4, 2])],
    sessionDefaultChannelGroup: [row(['Organic Search'], [2]), row(['Direct'], [1])],
    deviceCategory: [row(['mobile'], [2]), row(['desktop'], [1])],
    pagePath: [row(['/tim-san'], [4]), row(['/'], [2]), row(['/admin/users?secret=never-display'], [99])],
    sessionSourceMedium: [row(['google / organic'], [2]), row(['(direct) / (none)'], [1])],
    landingPage: [row(['/tim-san'], [2]), row(['/'], [1]), row(['/dat-san/SANABC234'], [99])],
    country: [row(['Vietnam'], [2])], city: [row(['Hanoi'], [2])],
    browser: [row(['Chrome'], [2])], operatingSystem: [row(['Android'], [2])], language: [row(['vi-vn'], [2])],
    hour: [row(['09'], [1]), row(['18'], [2])], newVsReturning: [row(['new'], [2]), row(['returning'], [1])],
    eventName: [row(['discovery_search'], [4]), row(['discovery_venue_open'], [3]), row(['discovery_booking_continue'], [1]), row(['private_event'], [99])],
  };
  if (dimension) return { rows: rows[dimension] ?? [], metadata: mode === 'thresholded' ? { subjectToThresholding: true } : {} };
  const previous = request.dateRanges?.[0]?.endDate !== 'today';
  return { rows: [row([], previous ? [1, 3, 2, 60, 60, 1, 1, 0.5, 0.5, 1.5] : [2, 6, 3, 120, 60, 1, 2, 2 / 3, 1 / 3, 2])], metadata: { timeZone: 'Asia/Ho_Chi_Minh' } };
}
