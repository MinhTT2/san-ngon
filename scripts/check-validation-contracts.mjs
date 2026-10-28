// Exercise the production schemas after the Zod upgrade, without credentials or writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(path) {
  const url = new URL(path, import.meta.url);
  if (cache.has(url.href)) return cache.get(url.href);
  const context = { exports: {}, require(name) {
    return name.startsWith('.') ? load(new URL(`${name}.ts`, url).href) : require(name);
  } };
  cache.set(url.href, context.exports);
  vm.runInNewContext(ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context, { filename: url.pathname });
  return context.exports;
}

const { VenueCreateBody, VenueManagementBody, CourtCreateBody, validationFieldErrors } = load('../lib/owner-management.ts');
const { tournamentSchema, participantSchema, tournamentValidationErrors } = load('../lib/tournaments.ts');
const { feedbackSchema } = load('../lib/feedback.ts');
// PostgreSQL accepts these existing IDs; Zod 4's RFC-only uuid() would reject them.
const legacyId = 'a0000000-0000-0000-0000-000000000001';
const venue = { name: 'Cụm sân kiểm thử', address: '12 Địa chỉ kiểm thử', district: 'Cầu Giấy', phone: '0912345678', open_time: '06:00', close_time: '23:00', deposit_pct: 100, booking_horizon_days: 180 };
assert(VenueManagementBody.safeParse(venue).success);
const deposit = VenueManagementBody.safeParse({ ...venue, deposit_pct: 90 });
assert(!deposit.success);
assert.equal(validationFieldErrors(deposit.error).deposit_pct, 'Tiền cọc bằng 100% tiền sân.');
const hours = VenueManagementBody.safeParse({ ...venue, close_time: '05:00' });
assert(!hours.success);
assert.equal(validationFieldErrors(hours.error).close_time, 'Giờ đóng cửa phải sau giờ mở cửa.');
const sport = { sport: 'badminton', court_count: 1, price_per_hour: 100000 };
assert(!VenueCreateBody.safeParse({ ...venue, sports: [sport, sport] }).success);
assert(!VenueCreateBody.safeParse({ ...venue, sports: Array.from({ length: 1000 }, () => sport) }).success);
const court = { venue_id: legacyId, name: 'Sân 1', sport: 'badminton', surface: null, is_indoor: true, slot_minutes: 60, open_time: null, close_time: null, price_per_hour: 100000 };
assert.equal(CourtCreateBody.parse(court).is_active, true, 'omitted active flag retains its default');
for (const id of ['not-a-uuid', `${legacyId}x`, legacyId.replaceAll('-', ''), 'g0000000-0000-0000-0000-000000000001']) {
  assert(!CourtCreateBody.safeParse({ ...court, venue_id: id }).success);
}

const tournament = { title: 'Giải cầu lông kiểm thử', description: 'Thể lệ kiểm thử hợp lệ.', sport: 'badminton', court_id: legacyId, address: '12 Địa chỉ kiểm thử', starts_at: '2030-03-01T10:00', ends_at: '2030-03-01T12:00', registration_deadline: '2030-02-28T12:00', payment_deadline: '2030-03-01T09:00', payment_hold_hours: '24', capacity: '16', entry_fee: '100000', deposit_amount: '50000' };
const parsed = tournamentSchema.parse(tournament);
assert.equal(parsed.capacity, 16);
assert.equal(parsed.cover_path, '');
for (const date of ['2030-02-29T10:00', '0000-01-01T10:00', '2030-03-01T25:00']) {
  assert(!tournamentSchema.safeParse({ ...tournament, starts_at: date }).success);
}
const invalid = tournamentSchema.safeParse({ ...tournament, title: ' ', capacity: 1, deposit_amount: '100001' });
assert(!invalid.success);
const errors = tournamentValidationErrors(invalid.error.issues);
assert.match(errors.title, /nhập ít nhất 3 ký tự/);
assert.match(errors.capacity, /nhập số từ 2 trở lên/);
assert.equal(errors.deposit_amount, 'Cọc mỗi suất không được vượt lệ phí.');
const longTitle = tournamentSchema.safeParse({ ...tournament, title: 'Đ'.repeat(151) });
assert(!longTitle.success);
assert.match(tournamentValidationErrors(longTitle.error.issues).title, /tối đa 150 ký tự/);
const participant = { full_name: 'Nguyễn Văn An', phone: '+84 (912) 345-678', address: 'Hà Nội', team_name: '', note: '' };
assert.equal(participantSchema.parse(participant).phone, '0912345678');
const badPhone = participantSchema.safeParse({ ...participant, phone: '091234567x' });
assert(!badPhone.success);
assert.match(tournamentValidationErrors(badPhone.error.issues).phone, /Số điện thoại gồm 10 chữ số/);
assert.equal(feedbackSchema.parse({ id: legacyId, category: 'support', title: 'Cần hỗ trợ', message: 'Thông tin cần hỗ trợ kiểm thử.' }).page_path, null);
console.log('OK: legacy PostgreSQL IDs, rejected malformed IDs, Vietnamese field errors, phone normalization, dates, defaults and bounded collections.');
