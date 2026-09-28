// Run: node scripts/check-venue-time-options.mjs
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
const { venueTimeOptions } = await import('../lib/venue-time-options.ts');
const slot = (court, hour, available = true, price = 100000, minutes = 60) => ({
  court_id: court, court_name: court, sport: 'badminton', slot_minutes: minutes,
  starts_at: `2026-09-29T${String(hour).padStart(2, '0')}:00:00+00:00`,
  ends_at: `2026-09-29T${String(hour + minutes / 60).padStart(2, '0')}:00:00+00:00`,
  price, is_available: available,
});

// Adjacent hours on different courts cannot form one booking.
assert.equal(venueTimeOptions([slot('A', 10), slot('A', 11, false), slot('B', 10, false), slot('B', 11)], 120)[0].choices.length, 0);
assert.equal(venueTimeOptions([slot('A', 10), slot('A', 12)], 120)[0].choices.length, 0);
const options = venueTimeOptions([
  slot('A', 10, true, 100000), slot('A', 11, true, 150000),
  slot('B', 10, true, 80000), slot('B', 11, true, 90000),
], 120);
assert.deepEqual(options[0].choices.map(c => [c.courtId, c.total]), [['B', 170000], ['A', 250000]]);
assert.equal(options[0].choices[0].slots.length, 2);
assert.equal(options[0].choices[0].endsAt, slot('B', 11).ends_at);
assert.equal(options[1].choices.length, 0); // Cannot extend past closing.
assert.equal(venueTimeOptions([slot('A', 10)], 30)[0].choices.length, 0);
assert.equal(venueTimeOptions([10, 11, 12, 13].map(h => slot('A', h)), 240)[0].choices.length, 0);
assert.equal(venueTimeOptions([10, 11, 12].map(h => slot('A', h)), 180)[0].choices.length, 1);
// Different slot lengths can cover the same duration, each on its own court.
assert.equal(venueTimeOptions([slot('A', 10), slot('A', 11), slot('B', 10, true, 200000, 120)], 120)[0].choices.length, 2);
const hundredCourts = Array.from({ length: 100 }, (_, i) => [slot(`Sân ${i + 1}`, 10), slot(`Sân ${i + 1}`, 11)]).flat();
const hundred = venueTimeOptions(hundredCourts, 120);
assert.equal(hundred.length, 2);
assert.equal(hundred[0].choices.length, 100);
assert.deepEqual(hundred[0].choices.slice(0, 3).map(c => c.courtName), ['Sân 1', 'Sân 2', 'Sân 3']);
assert.deepEqual(venueTimeOptions([], 60), []);
console.log('OK: continuous same-court availability, full-duration prices, slot limits, mixed lengths, 100 courts.');
