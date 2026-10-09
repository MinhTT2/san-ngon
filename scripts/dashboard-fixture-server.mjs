// Local Supabase-shaped read fixture for dashboard UI checks. Never uses keys or a remote database.
// Start: node scripts/dashboard-fixture-server.mjs (port 3210).
// Run the app with NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3210 and NEXT_PUBLIC_SUPABASE_ANON_KEY=dashboard-ui-fixture.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ownerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const venueId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const courtId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const created = '2026-10-01T03:00:00Z';
const fixturePort = Number(process.env.DASHBOARD_FIXTURE_PORT || 3210);
const future = '2026-12-01T03:00:00Z';
const base = { phone: '0901234567', created_at: created, avatar_url: null, banned_until: null, telegram_chat_id: 'fixture', owner_application_status: 'active', business_license_path: 'fixture/license.pdf', business_license_name: 'Giấy đăng ký', payout_bank: 'MB', payout_account: '0123456789' };
const people = [{ ...base, id: adminId, full_name: 'Quản trị viên kiểm tra', role: 'admin' }, { ...base, id: ownerId, full_name: 'Nguyễn Minh', role: 'owner' }, ...Array.from({ length: 23 }, (_, i) => ({ ...base, id: `owner-${i}`, full_name: `Chủ sân ${i + 1}`, role: 'player', owner_application_status: i === 22 ? 'rejected' : 'pending' }))];
const court = { id: courtId, venue_id: venueId, name: 'Cầu lông 01', sport: 'badminton', slot_minutes: 60, surface: 'tham', is_indoor: true, open_time: null, close_time: null, is_active: true, sort_order: 1, price_rules: [{ id: 'price-base', days: [1, 2, 3, 4, 5, 6, 0], priority: 0, price_per_hour: 100000, start_time: '06:00:00', end_time: '23:00:00', label: 'Giá chung' }], venues: { id: venueId, name: 'Sân Cầu Giấy', owner_id: ownerId } };
const venues = [{ id: venueId, name: 'Sân Cầu Giấy', slug: 'san-cau-giay', address: '123 Cầu Giấy, Hà Nội', district: 'Cầu Giấy', status: 'active', owner_id: ownerId, created_at: created, phone: base.phone, business_license_path: null, images: ['fixture1.webp', 'fixture2.webp', 'fixture3.webp'], open_time: '06:00:00', close_time: '23:00:00', deposit_pct: 100, booking_horizon_days: 30, description: 'Sân trong nhà, đủ ánh sáng và có chỗ để xe.', amenities: ['Chỗ để xe'], courts: [court] }, { id: 'venue-pending', name: 'Sân chờ duyệt', slug: 'san-cho-duyet', district: 'Ba Đình', status: 'pending', owner_id: ownerId, created_at: created, phone: base.phone, business_license_path: 'fixture.pdf', courts: [] }];
const bookings = [{ id: 'booking-1', code: 'SANABC234', court_id: courtId, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString(), status: 'confirmed', total_amount: 100000, deposit_amount: 100000, refund_status: null, customer_name: 'Lê Hải', customer_phone: base.phone, courts: { name: court.name, venue_id: venueId, venues: { name: venues[0].name, slug: venues[0].slug, district: venues[0].district, status: 'active' }, sport: 'badminton' } }, { id: 'booking-2', code: 'SANDEF567', court_id: courtId, starts_at: future, ends_at: '2026-12-01T04:00:00Z', status: 'pending', total_amount: 120000, deposit_amount: 120000, refund_status: null, customer_name: 'Mai Anh', customer_phone: base.phone, courts: { name: court.name, venue_id: venueId, venues: { name: venues[0].name, slug: venues[0].slug, district: venues[0].district, status: 'active' }, sport: 'badminton' } }];
bookings.forEach((booking, i) => { booking.expires_at = new Date(Date.now() + 15 * 60000).toISOString(); booking.paid_at = i === 0 ? created : null; });
const checkoutBase = { ...bookings[1], id: 'checkout-pending', payment_bank: 'MB', payment_account: '0123456789', payment_account_name: 'SAN NGON KIEM THU', courts: { ...bookings[1].courts, venues: { ...bookings[1].courts.venues, address: venues[0].address } } };
const checkoutBookings = {
  SANDEF567: checkoutBase,
  SANABC234: { ...checkoutBase, id: 'checkout-confirmed', code: 'SANABC234', status: 'confirmed' },
  SANHJK234: { ...checkoutBase, id: 'checkout-completed', code: 'SANHJK234', status: 'completed', starts_at: created, ends_at: '2026-10-01T04:00:00Z' },
  SANCAN234: { ...checkoutBase, id: 'checkout-cancelled', code: 'SANCAN234', status: 'cancelled' },
  SANEXP234: { ...checkoutBase, id: 'checkout-expired', code: 'SANEXP234', expires_at: created },
  SANBAD234: { ...checkoutBase, id: 'checkout-unconfigured', code: 'SANBAD234', payment_account: '' },
  SANLNG234: { ...checkoutBase, id: 'checkout-long', code: 'SANLNG234', total_amount: 1500000, deposit_amount: 1500000, courts: { ...checkoutBase.courts, venues: { ...checkoutBase.courts.venues, name: 'Cụm sân thể thao Cầu Giấy — Nhà thi đấu phía Tây' } } },
};
const subscription = { owner_id: ownerId, full_name: 'Nguyễn Minh', phone: base.phone, fee_required: false, paid_until: future, active: true, amount: 299000 };
const invoice = { id: 'invoice-1', owner_id: ownerId, code: 'PHI1234ABCD', amount: 299000, status: 'paid', created_at: created, paid_at: created, period_end: future };
const pendingTournament = { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Giải cầu lông mùa thu', sport: 'badminton', starts_at: future, ends_at: '2026-12-01T08:00:00Z', registration_deadline: '2026-11-25T03:00:00Z', capacity: 16, entry_fee: 200000, deposit_amount: 100000, address: venues[0].address, status: 'pending', cover_path: null };
const tournaments = [pendingTournament, { ...pendingTournament, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef', title: 'Cầu lông Hà Nội mở rộng', status: 'published' }, { ...pendingTournament, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeea', title: 'Pickleball cuối tuần', sport: 'pickleball', entry_fee: 0, deposit_amount: 0, status: 'published' }];
const summary = { bookings: 18, paid_bookings: 16, revenue: 3200000, deposit: 3200000, cancelled: 1, pending: 2, capacity_hours: 280, booked_hours: 48, occupancy_pct: 17.1, cancellation_pct: 5.6, active_venues: 1, active_courts: 1, players: 23, owners: 1, new_players: 4, pending_bookings: 2, pending_owners: 22, pending_venues: 1 };
const stats = { from: '2026-09-09', to: '2026-10-08', summary, daily: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, revenue: i % 3 ? i * 10000 : 0, bookings: 2 })), courts: [{ name: court.name, hours: 48, bookings: 18, revenue: 3200000 }], venues: [{ name: venues[0].name, district: 'Cầu Giấy', bookings: 18, revenue: 3200000 }] };
const feedback = [{ id: 'feedback-1', category: 'bug', title: 'Cần hỗ trợ chọn lịch', message: 'Tôi muốn xem lịch ở một ngày khác.', page_path: '/tim-san', status: 'new', reply: null, created_at: created, updated_at: created, sender: { full_name: 'Lê Hải' } }];
const users = people.slice(0, 5).map((p, i) => ({ ...p, email: `test${i}@example.invalid`, is_banned: i === 3, banned_until: i === 3 ? 'infinity' : null, ban_reason: i === 3 ? 'Tài khoản kiểm tra' : null }));
const publicVenues = [{ ...venues[0], court_count: 3, sports: ['badminton'], available_slots: 18, min_price: 100000, next_slot: future }];
const publicPlayers = [
  { user_id: ownerId, display_name: 'Minh', location: 'Cầu Giấy, Hà Nội', sport: 'badminton', skill_level: 'intermediate', usual_play_times: 'Tối thứ ba và thứ năm', bio: 'Chơi đôi, thường đặt sân trong nhà.', avatar_url: null },
  { user_id: adminId, display_name: 'Hà', location: 'Ba Đình, Hà Nội', sport: 'pickleball', skill_level: 'beginner', usual_play_times: 'Sáng cuối tuần', bio: 'Mới chơi, muốn tập đều cuối tuần.', avatar_url: null },
];
const notifications = [adminId, ownerId].flatMap(user_id => [
  { id: `${user_id.slice(0, 8)}-1111-4111-8111-111111111111`, user_id, title: 'Đã nhận cọc cho lịch cầu lông', body: 'Đơn SANABC234 đã được xác nhận. Xem lại sân và giờ chơi trước khi ra sân.', created_at: '2026-10-08T11:00:00Z', read_at: null, booking_id: 'booking-1', booking: { code: 'SANABC234' }, tournament_id: null },
  { id: `${user_id.slice(0, 8)}-2222-4222-8222-222222222222`, user_id, title: 'Đăng ký giải cầu lông đã được duyệt', body: 'Ban tổ chức đã duyệt suất tham gia của bạn. Xem chi tiết giải để kiểm tra hạn chuyển cọc.', created_at: '2026-10-08T03:00:00Z', read_at: null, booking_id: null, booking: null, tournament_id: tournaments[1].id },
  { id: `${user_id.slice(0, 8)}-3333-4333-8333-333333333333`, user_id, title: 'Hồ sơ chủ sân đã được duyệt', body: 'Bạn có thể tạo cụm sân và bổ sung ảnh thật để bắt đầu nhận đặt sân.', created_at: '2026-10-01T03:00:00Z', read_at: '2026-10-01T04:00:00Z', booking_id: null, booking: null, tournament_id: null },
]);
const tables = { profiles: people, venues, courts: [court], bookings, subscription_receiver: [{ bank: 'MB', account_number: '0987654321', account_name: 'SAN NGON' }], subscription_invoices: [invoice], subscription_payment_events: [{ transaction_key: 'fixture-tx', invoice_id: invoice.id, amount: 299000, created_at: created, outcome: 'paid', subscription_invoices: { code: invoice.code, owner_id: ownerId } }], feedback, tournaments, notifications, venue_favorites: [] };
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const url = new URL(req.url, `http://127.0.0.1:${fixturePort}`);
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
  let role = 'admin';
  let connectionState = 'ready';
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    role = claims.fixture_role || 'admin'; connectionState = claims.fixture_connection || 'ready';
  } catch { /* Anonymous requests use only public fixture data. */ }
  const me = role === 'owner' ? people[1] : people[0];
  const send = (data, code = 200) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  if (url.pathname.startsWith('/storage/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { send({ message: 'Fixture storage is read-only.' }, 403); return; }
    try { res.setHeader('Content-Type', 'image/webp'); res.end(await readFile(new URL('../public/media/badminton-editorial.webp', import.meta.url))); } catch { res.statusCode = 404; res.end(); }
    return;
  }
  if (url.pathname === '/auth/v1/user') { send({ id: me.id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', user_metadata: { full_name: me.full_name }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: created }); return; }
  let body = '';
  for await (const chunk of req) body += chunk;
  const args = body ? JSON.parse(body) : {};
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const name = url.pathname.split('/').at(-1);
    if (name === 'search_venues') {
      const rows = publicVenues.filter(v => (!args.p_sport || v.sports.includes(args.p_sport)) && (!args.p_district || v.district === args.p_district) && (!args.p_query || `${v.name} ${v.address}`.toLowerCase().includes(args.p_query.toLowerCase())));
      send({ today: '2026-10-08', date: args.p_date || '2026-10-08', last_date: '2026-11-07', total: rows.length, page: 1, pages: 1, venues: rows }); return;
    }
    if (name === 'search_community') {
      const rows = publicPlayers.filter(p => (!args.p_sport || p.sport === args.p_sport) && (!args.p_location || p.location.toLowerCase().includes(args.p_location.toLowerCase())));
      send({ total: rows.length, rows }); return;
    }
    if (name === 'get_venue_calendar') {
      send({ today: '2026-10-08', date: args.p_date || '2026-10-08', last_date: '2026-11-07', days: [{ date: '2026-10-08', weekday: 4 }, { date: '2026-10-09', weekday: 5 }] }); return;
    }
    if (name === 'venue_accepts_bookings') { send(true); return; }
    if (name === 'get_venue_availability') {
      const date = args.p_date || '2026-10-08';
      send([10, 11, 12, 13, 14, 15, 16, 17].map(hour => ({ court_id: courtId, court_name: court.name, sport: court.sport, slot_minutes: 60, starts_at: `${date}T${hour}:00:00+07:00`, ends_at: `${date}T${hour + 1}:00:00+07:00`, price: 100000, is_available: true }))); return;
    }
    if (name === 'get_my_sepay_connection' && connectionState !== 'ready') {
      send({ status: connectionState === 'authorized' ? 'setup' : connectionState, bank: null, account_number: null, account_name: null, bank_account_id: null, has_authorization: connectionState === 'authorized', rollout_enabled: false, checked_at: null, last_webhook_at: null }); return;
    }
    const rpc = { is_admin: role === 'admin', get_admin_stats: stats, get_owner_stats: stats, get_owner_period_stats: stats, get_my_subscription: subscription, get_admin_subscriptions: [subscription, { ...subscription, owner_id: 'owner-22', full_name: 'Trần Hà', fee_required: true, active: false }], get_my_sepay_connection: { status: 'ready', bank: 'MB', account_number: base.payout_account, account_name: 'NGUYEN MINH', bank_account_id: 'fixture-bank', has_authorization: true, rollout_enabled: false, checked_at: created, last_webhook_at: null }, admin_list_users: { users: users.filter(u => (!args.p_search || `${u.full_name} ${u.email}`.toLowerCase().includes(args.p_search.toLowerCase())) && (args.p_role === 'all' || !args.p_role || u.role === args.p_role) && (args.p_status === 'all' || !args.p_status || (args.p_status === 'banned') === u.is_banned)), total: users.length, active: 4, banned: 1 } };
    if (!(name in rpc)) { send({ message: `Fixture rejects unknown RPC ${name}` }, 403); return; }
    send(rpc[name]); return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { send({ message: 'Fixture is read-only.' }, 403); return; }
  const table = url.pathname.split('/').at(-1);
  if (table === 'bookings' && url.searchParams.has('code')) { send(checkoutBookings[url.searchParams.get('code').replace(/^eq\./, '')] ?? null); return; }
  if (!(table in tables)) { send({ message: `Unknown fixture table ${table}` }, 404); return; }
  let rows = [...tables[table]];
  if (table === 'notifications') {
    rows = rows.filter(row => row.user_id === me.id);
    if (url.searchParams.get('read_at') === 'is.null') rows = rows.filter(row => row.read_at === null);
  }
  for (const field of ['id', 'owner_id', 'status', 'category', 'refund_status', 'sport', 'slug']) {
    const value = url.searchParams.get(field);
    if (value?.startsWith('eq.')) rows = rows.filter(row => String(row[field]) === value.slice(3));
    if (value?.startsWith('in.(') && value.endsWith(')')) rows = rows.filter(row => value.slice(4, -1).split(',').includes(String(row[field])));
  }
  const count = rows.length;
  const range = req.headers.range?.split('-').map(Number);
  if (range) rows = rows.slice(range[0], range[1] + 1);
  if (url.searchParams.has('limit')) rows = rows.slice(0, Number(url.searchParams.get('limit')));
  res.setHeader('Content-Range', `0-${Math.max(0, rows.length - 1)}/${count}`);
  if ((req.headers.accept || '').includes('application/vnd.pgrst.object+json')) send(rows[0] || null);
  else send(rows);
});
server.listen(fixturePort, '127.0.0.1', () => console.log(`Read-only UI fixture listening on ${fixturePort}.`));
