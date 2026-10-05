import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(path, imports = {}) {
  const context = { exports: {}, Request, Response, require: name => imports[name] ?? require(name) };
  const source = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, context);
  return context.exports;
}
const profile = load('lib/profile.ts');
const status = load('lib/tournament-status.ts');
const tournaments = load('lib/tournaments.ts', { './profile': profile, './tournament-status': status });
const input = {
  title: 'Giải kiểm tra', description: 'Thể lệ kiểm tra đầy đủ', sport: 'badminton', court_id: '', address: 'Cầu Giấy, Hà Nội',
  starts_at: '2030-10-15T10:00', ends_at: '2030-10-15T12:00', registration_deadline: '2030-10-14T10:00',
  payment_deadline: '2030-10-15T09:00', payment_hold_hours: 24, capacity: 16, entry_fee: 200000, deposit_amount: 100000,
};
assert(tournaments.tournamentSchema.safeParse(input).success);
for (const field of ['starts_at', 'ends_at', 'registration_deadline', 'payment_deadline']) {
  for (const value of ['2030-02-30T10:00', '2030-02-29T10:00', '2030-13-01T10:00', '2030-10-15T24:00', '2030-10-15T10:60', '0000-10-15T10:00']) {
    const invalid = tournaments.tournamentSchema.safeParse({ ...input, [field]: value });
    assert(!invalid.success, `${field}: ${value}`);
    assert(tournaments.tournamentValidationErrors(invalid.error.issues)[field]);
  }
}
assert(tournaments.tournamentSchema.safeParse({ ...input, starts_at: '2032-02-29T10:00', ends_at: '2032-02-29T12:00', registration_deadline: '2032-02-28T10:00', payment_deadline: '2032-02-29T09:00' }).success, 'leap day is a valid local calendar date');
for (const [change, field] of [
  [{ deposit_amount: 200001 }, 'deposit_amount'], [{ ends_at: input.starts_at }, 'ends_at'],
  [{ registration_deadline: '2030-10-15T09:01' }, 'registration_deadline'], [{ payment_deadline: '2030-10-15T10:01' }, 'payment_deadline'],
]) {
  const parsed = tournaments.tournamentSchema.safeParse({ ...input, ...change });
  assert(!parsed.success);
  assert(parsed.error.issues.some(issue => issue.path[0] === field && issue.code === 'custom'));
}
const participant = { full_name: 'Người tham gia', phone: '+84 900-000-004', address: 'Hà Nội', team_name: '', note: '' };
assert.equal(tournaments.participantSchema.parse(participant).phone, '0900000004');
assert(!tournaments.participantSchema.safeParse({ ...participant, phone: 'abcdefghij' }).success);
for (const phone of [undefined, '0'.repeat(26)]) {
  const invalid = tournaments.participantSchema.safeParse({ ...participant, phone });
  assert(!invalid.success);
  assert.match(tournaments.tournamentValidationErrors(invalid.error.issues).phone, /Số điện thoại/);
}
const now = Date.parse('2030-10-05T10:00:00Z');
const tournament = { ...input, id: 'e2900000-0000-4000-8000-000000000001', status: 'published', starts_at: '2030-10-15T03:00:00Z', ends_at: '2030-10-15T05:00:00Z', registration_deadline: '2030-10-14T03:00:00Z' };
assert.equal(tournaments.tournamentLabel(tournament, now), 'Đang nhận đăng ký');
assert.equal(tournaments.tournamentLabel({ ...tournament, starts_at: '2030-10-05T09:00:00Z', ends_at: '2030-10-05T11:00:00Z' }, now), 'Đang diễn ra');
assert.equal(tournaments.tournamentLabel({ ...tournament, ends_at: '2030-10-05T09:00:00Z' }, now), 'Đã kết thúc');
assert.equal(tournaments.tournamentLabel({ ...tournament, status: 'cancelled' }, now), 'Đã hủy');
assert.equal(tournaments.registrationLabel({ status: 'approved', deposit_amount: 0, paid_at: null }), 'Đã xác nhận tham gia');
assert.equal(tournaments.registrationLabel({ status: 'approved', deposit_amount: 100000, paid_at: null }), 'Chờ đóng cọc');

const format = { vnd: value => `${value}đ`, dayLabel: () => '15/10/2030', hhmm: () => '10:00' };
function ActionForm({ children, label }) { return React.createElement('form', null, children, React.createElement('button', null, label)); }
const { TournamentRegistration } = load('components/tournament-registration.tsx', {
  './tournament-payment-qr': { TournamentPaymentQr: ({ src, alt }) => React.createElement('img', { src, alt }) }, '@/lib/tournaments': tournaments, '@/lib/format': format,
  '@/lib/sepay': { vietQrUrl: () => 'https://test.invalid/qr.png' }, './action-form': { ActionForm },
  './copy-value': { CopyValue: ({ value }) => React.createElement('span', null, value) },
});
const registration = { ...participant, id: 'registration', status: 'approved', paid_at: null, deposit_amount: 100000, entry_fee: 200000,
  bank: 'MB', account_number: '0000000000', account_name: 'TEST', code: 'GIAIABCDEF123456', payment_expires_at: '2030-10-06T10:00:00Z', refund_deadline: '2030-10-14T03:00:00Z' };
const renderRegistration = changes => renderToStaticMarkup(React.createElement(TournamentRegistration, { registration: { ...registration, ...changes }, tournament, now, canRegisterAgain: false }));
assert.match(renderRegistration({}), /<img/);
assert.doesNotMatch(renderRegistration({ paid_at: '2030-10-05T09:00:00Z' }), /<img/);
assert.doesNotMatch(renderRegistration({ status: 'pending' }), /<img/);
assert.doesNotMatch(renderRegistration({ status: 'expired' }), /<img/);
assert.doesNotMatch(renderRegistration({ payment_expires_at: '2030-10-05T09:00:00Z' }), /<img/);
assert.doesNotMatch(renderRegistration({ deposit_amount: 0 }), /<img/);
const cancelled = renderToStaticMarkup(React.createElement(TournamentRegistration, { registration, tournament: { ...tournament, status: 'cancelled' }, now, canRegisterAgain: false }));
assert.match(cancelled, /Giải đã hủy/);
assert.doesNotMatch(cancelled, /<img|Hủy tham gia|Tiến trình đăng ký/);
console.log('OK: input validation, phone normalization, display states, QR eligibility and cancellation.');

let state = [], cursor = 0;
const hooks = { ...React, useState(initial) { const position = cursor++; if (!(position in state)) state[position] = initial; return [state[position], value => { state[position] = value; }]; } };
const field = load('components/form-field.tsx');
const { TournamentReviewForm } = load('components/tournament-review-form.tsx', { react: hooks, './form-field': field, './action-form': { ActionForm } });
function nodes(node) { return !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]; }
function review() { cursor = 0; return TournamentReviewForm({ id: tournament.id, courtId: null, courts: [] }); }
assert(nodes(review()).some(node => node.props?.name === 'terms_confirmed' && node.props.required));
nodes(review()).find(node => node.props?.name === 'approve').props.onChange({ target: { value: 'false' } });
assert(!nodes(review()).some(node => node.props?.name === 'venue_fee' || node.props?.name === 'terms_confirmed'));
assert(nodes(review()).some(node => node.props?.name === 'note' && node.props.required));
assert.equal(review().props.payload.terms_confirmed, false);

state = [];
const reviewRegistration = load('components/tournament-review-registration.tsx', { './form-field': field, './action-form': { ActionForm } });
const { TournamentParticipants } = load('components/tournament-participants.tsx', { react: hooks, '@/lib/tournament-status': status, '@/lib/format': format, './form-field': field, './action-form': { ActionForm }, './tournament-review-registration': reviewRegistration });
const registrations = [{ ...registration, id: 'pending', status: 'pending', full_name: 'Chờ duyệt' }, { ...registration, id: 'unpaid', team_name: 'Đội xanh' }, { ...registration, id: 'paid', paid_at: '2030-10-05T09:00:00Z' }];
function participants(started = false) { cursor = 0; return TournamentParticipants({ registrations, closed: false, started, canCancel: true, userId: 'manager', admin: false }); }
assert.equal(nodes(participants()).filter(node => node.type === 'details' && node.key).length, 3);
nodes(participants()).find(node => node.type === 'select').props.onChange({ target: { value: 'unpaid' } });
assert.equal(nodes(participants()).filter(node => node.type === 'details' && node.key).length, 1);
nodes(participants()).find(node => node.props?.type === 'search').props.onChange({ target: { value: 'doi xanh' } });
assert.equal(nodes(participants()).filter(node => node.type === 'details' && node.key).length, 1);
nodes(participants()).find(node => node.props?.type === 'search').props.onChange({ target: { value: 'không khớp' } });
assert.equal(nodes(participants()).filter(node => node.type === 'details' && node.key).length, 0);
state = [];
registrations[1] = { ...registrations[1], user_id: 'manager' };
const selfCancellation = nodes(participants()).find(node => node.props?.payload?.action === 'cancel_registration' && node.props.payload.id === 'unpaid');
assert.match(selfCancellation.props.confirmMessage, /áp dụng chính sách tự hủy/);
assert.equal(selfCancellation.props.label, 'Hủy đăng ký của bạn');
assert(!nodes(participants(true)).some(node => node.props?.payload?.action === 'cancel_registration' && node.props.payload.id === 'unpaid'));
assert(nodes(participants(true)).some(node => node.props?.payload?.action === 'cancel_registration' && node.props.payload.id === 'paid'));
console.log('OK: conditional review requirements and participant search/status filters.');

state = [];
const { TournamentPaymentQr } = load('components/tournament-payment-qr.tsx', { react: hooks,
  'next/image': { default: () => null },
});
function qr() { cursor = 0; return TournamentPaymentQr({ src: 'https://test.invalid/qr.png', alt: 'QR cọc' }); }
nodes(qr()).find(node => typeof node.props?.onError === 'function').props.onError();
assert.match(renderToStaticMarkup(qr()), /Không tải được mã QR/);
nodes(qr()).find(node => node.type === 'button').props.onClick();
assert(!nodes(qr()).some(node => node.type === 'button'));
assert(nodes(reviewRegistration.TournamentReviewRegistration({ id: registration.id })).some(node => node.props?.name === 'note' && !node.props.required));
console.log('OK: QR fallback/retry and optional approval notes.');

let settlement = { owner_id: 'owner', manager_id: 'manager', balance: 0, can_settle: true, pending_transfer: false,
  venue_fee: 0, cancellation_venue_fee: 0, due_at: tournament.ends_at, terms_note: 'Thỏa thuận',
  bank_received: 0, balance_received: 0, refund_due: 0, balance_refund_due: 0, uncollected_count: 0,
};
const { TournamentSettlementPanel } = load('components/tournament-settlement.tsx', {
  '@/lib/supabase/server': { createClient: async () => ({
    rpc: async () => ({ data: settlement, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) }),
  }) }, '@/lib/format': format, './form-field': field, './action-form': { ActionForm },
});
const settlementHtml = async () => renderToStaticMarkup(await TournamentSettlementPanel({ id: tournament.id, userId: 'owner', admin: false }));
assert.match(await settlementHtml(), /Không còn khoản cần chuyển/);
assert.doesNotMatch(await settlementHtml(), /<button/);
settlement = { ...settlement, pending_transfer: true };
assert.match(await settlementHtml(), /Chờ bên nhận kiểm tra/);
settlement = { ...settlement, pending_transfer: false, balance: 100000 };
assert.match(await settlementHtml(), /Đã chuyển 100000đ/);
settlement = { ...settlement, balance: 0, manager_id: 'owner' };
assert.match(await settlementHtml(), /không cần chuyển quyết toán cho bên khác/);
assert.doesNotMatch(await settlementHtml(), /Còn phải chuyển quyết toán/);
console.log('OK: settled, pending-transfer and self-organized settlement guidance.');

const calls = [];
const { POST } = load('app/api/tournaments/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
  '@/lib/tournaments': tournaments, '@/lib/request-origin': { requestOrigin: () => 'http://localhost' },
  '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'player' } } }) }, rpc: async (...args) => { calls.push(args); return { data: registration.id, error: null }; } }) },
});
function request(body) { return new Request('http://localhost/api/tournaments', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(body) }); }
const invalid = await POST(request({ action: 'submit', data: { ...input, deposit_amount: 200001 } }));
assert.equal(invalid.status, 400);
const invalidBody = await invalid.json();
assert.match(invalidBody.error, /Cọc mỗi suất/);
assert.match(invalidBody.fieldErrors.deposit_amount, /Cọc mỗi suất/);
const invalidFields = await POST(request({ action: 'submit', data: { ...input, title: '   ab   ', description: '   short   ', capacity: 1 } }));
const invalidFieldsBody = await invalidFields.json();
assert.equal(invalidFields.status, 400);
assert.match(invalidFieldsBody.fieldErrors.title, /ít nhất 3 ký tự/);
assert.match(invalidFieldsBody.fieldErrors.description, /ít nhất 10 ký tự/);
assert.match(invalidFieldsBody.fieldErrors.capacity, /từ 2/);
assert.equal(tournaments.tournamentErrorFields.TOURNAMENT_REGISTRATION_PAST, 'registration_deadline');
assert.match(tournaments.tournamentError('TOURNAMENT_REGISTRATION_PAST'), /đã qua/);
assert.equal(calls.length, 0);
const response = await POST(request({ action: 'register', id: tournament.id, data: participant }));
assert.equal(response.status, 200);
assert.equal(calls[0][1].p_data.phone, '0900000004');
console.log('OK: API returns specific validation errors and forwards normalized data to SQL.');
