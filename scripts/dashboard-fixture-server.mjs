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
const future = '2026-12-01T03:00:00Z';
const base = { phone: '0901234567', created_at: created, avatar_url: null, banned_until: null, telegram_chat_id: 'fixture', owner_application_status: 'active', business_license_path: 'fixture/license.pdf', business_license_name: 'Giấy đăng ký', payout_bank: 'MB', payout_account: '0123456789' };
const people = [{ ...base, id: adminId, full_name: 'Quản trị viên kiểm tra', role: 'admin' }, { ...base, id: ownerId, full_name: 'Nguyễn Minh', role: 'owner' }, ...Array.from({ length: 23 }, (_, i) => ({ ...base, id: `owner-${i}`, full_name: `Chủ sân ${i + 1}`, role: 'player', owner_application_status: i === 22 ? 'rejected' : 'pending' }))];
const court = { id: courtId, venue_id: venueId, name: 'Cầu lông 01', sport: 'badminton', slot_minutes: 60, surface: 'tham', is_indoor: true, open_time: null, close_time: null, is_active: true, sort_order: 1, price_rules: [{ price_per_hour: 100000, start_time: '06:00:00', end_time: '23:00:00', label: 'Giá chung' }], venues: { id: venueId, name: 'Sân Cầu Giấy', owner_id: ownerId } };
const venues = [{ id: venueId, name: 'Sân Cầu Giấy', slug: 'san-cau-giay', address: '123 Cầu Giấy, Hà Nội', district: 'Cầu Giấy', status: 'active', owner_id: ownerId, created_at: created, phone: base.phone, business_license_path: null, images: ['fixture1.webp', 'fixture2.webp', 'fixture3.webp'], open_time: '06:00:00', close_time: '23:00:00', deposit_pct: 100, booking_horizon_days: 30, description: 'Sân trong nhà, đủ ánh sáng và có chỗ để xe.', amenities: ['Chỗ để xe'], courts: [court] }, { id: 'venue-pending', name: 'Sân chờ duyệt', slug: 'san-cho-duyet', district: 'Ba Đình', status: 'pending', owner_id: ownerId, created_at: created, phone: base.phone, business_license_path: 'fixture.pdf', courts: [] }];
const bookings = [{ id: 'booking-1', code: 'SANABC234', court_id: courtId, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 3600000).toISOString(), status: 'confirmed', total_amount: 100000, deposit_amount: 100000, refund_status: null, customer_name: 'Lê Hải', customer_phone: base.phone, courts: { name: court.name, venue_id: venueId, venues: { name: venues[0].name } } }, { id: 'booking-2', code: 'SANDEF567', court_id: courtId, starts_at: future, ends_at: '2026-12-01T04:00:00Z', status: 'pending', total_amount: 120000, deposit_amount: 120000, refund_status: null, customer_name: 'Mai Anh', customer_phone: base.phone, courts: { name: court.name, venue_id: venueId, venues: { name: venues[0].name } } }];
const subscription = { owner_id: ownerId, full_name: 'Nguyễn Minh', phone: base.phone, fee_required: false, paid_until: future, active: true, amount: 299000 };
const invoice = { id: 'invoice-1', owner_id: ownerId, code: 'PHI1234ABCD', amount: 299000, status: 'paid', created_at: created, paid_at: created, period_end: future };
const tournaments = [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Giải cầu lông mùa thu', sport: 'badminton', starts_at: future, ends_at: '2026-12-01T08:00:00Z', registration_deadline: '2026-11-25T03:00:00Z', capacity: 16, entry_fee: 200000, deposit_amount: 100000, address: venues[0].address, status: 'pending', cover_path: null }];
const summary = { bookings: 18, paid_bookings: 16, revenue: 3200000, deposit: 3200000, cancelled: 1, pending: 2, capacity_hours: 280, booked_hours: 48, occupancy_pct: 17.1, cancellation_pct: 5.6, active_venues: 1, active_courts: 1, players: 23, owners: 1, new_players: 4, pending_bookings: 2, pending_owners: 22, pending_venues: 1 };
const stats = { from: '2026-09-09', to: '2026-10-08', summary, daily: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, revenue: i % 3 ? i * 10000 : 0, bookings: 2 })), courts: [{ name: court.name, hours: 48, bookings: 18, revenue: 3200000 }], venues: [{ name: venues[0].name, district: 'Cầu Giấy', bookings: 18, revenue: 3200000 }] };
const feedback = [{ id: 'feedback-1', category: 'bug', title: 'Cần hỗ trợ chọn lịch', message: 'Tôi muốn xem lịch ở một ngày khác.', page_path: '/tim-san', status: 'new', reply: null, created_at: created, updated_at: created, sender: { full_name: 'Lê Hải' } }];
const users = people.slice(0, 5).map((p, i) => ({ ...p, email: `test${i}@example.invalid`, is_banned: i === 3, banned_until: i === 3 ? 'infinity' : null, ban_reason: i === 3 ? 'Tài khoản kiểm tra' : null }));
const tables = { profiles: people, venues, courts: [court], bookings, subscription_receiver: [{ bank: 'MB', account_number: '0987654321', account_name: 'SAN NGON' }], subscription_invoices: [invoice], subscription_payment_events: [{ transaction_key: 'fixture-tx', invoice_id: invoice.id, amount: 299000, created_at: created, outcome: 'paid', subscription_invoices: { code: invoice.code, owner_id: ownerId } }], feedback, tournaments, notifications: [], venue_favorites: [] };
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:3210');
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '');
  let role = 'admin';
  try { role = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).fixture_role || 'admin'; } catch { /* Anonymous requests use only public fixture data. */ }
  const me = role === 'owner' ? people[1] : people[0];
  const send = (data, code = 200) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  if (url.pathname.startsWith('/storage/')) {
    try { res.setHeader('Content-Type', 'image/webp'); res.end(await readFile(new URL('../public/media/badminton-editorial.webp', import.meta.url))); } catch { res.statusCode = 404; res.end(); }
    return;
  }
  if (url.pathname === '/auth/v1/user') { send({ id: me.id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', user_metadata: { full_name: me.full_name }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: created }); return; }
  let body = '';
  for await (const chunk of req) body += chunk;
  const args = body ? JSON.parse(body) : {};
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const name = url.pathname.split('/').at(-1);
    const rpc = { is_admin: role === 'admin', get_admin_stats: stats, get_owner_stats: stats, get_owner_period_stats: stats, get_my_subscription: subscription, get_admin_subscriptions: [subscription, { ...subscription, owner_id: 'owner-22', full_name: 'Trần Hà', fee_required: true, active: false }], get_my_sepay_connection: { status: 'ready', bank: 'MB', account_number: base.payout_account, account_name: 'NGUYEN MINH', bank_account_id: 'fixture-bank', has_authorization: true, rollout_enabled: false, checked_at: created, last_webhook_at: null }, admin_list_users: { users: users.filter(u => (!args.p_search || `${u.full_name} ${u.email}`.toLowerCase().includes(args.p_search.toLowerCase())) && (args.p_role === 'all' || !args.p_role || u.role === args.p_role) && (args.p_status === 'all' || !args.p_status || (args.p_status === 'banned') === u.is_banned)), total: users.length, active: 4, banned: 1 } };
    if (!(name in rpc)) { send({ message: `Fixture rejects unknown RPC ${name}` }, 403); return; }
    send(rpc[name]); return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { send({ message: 'Fixture is read-only.' }, 403); return; }
  const table = url.pathname.split('/').at(-1);
  if (!(table in tables)) { send({ message: `Unknown fixture table ${table}` }, 404); return; }
  let rows = [...tables[table]];
  for (const field of ['id', 'owner_id', 'status', 'category', 'refund_status']) {
    const value = url.searchParams.get(field);
    if (value?.startsWith('eq.')) rows = rows.filter(row => String(row[field]) === value.slice(3));
  }
  const count = rows.length;
  const range = req.headers.range?.split('-').map(Number);
  if (range) rows = rows.slice(range[0], range[1] + 1);
  if (url.searchParams.has('limit')) rows = rows.slice(0, Number(url.searchParams.get('limit')));
  res.setHeader('Content-Range', `0-${Math.max(0, rows.length - 1)}/${count}`);
  if ((req.headers.accept || '').includes('application/vnd.pgrst.object+json')) send(rows[0] || null);
  else send(rows);
});
server.listen(3210, '0.0.0.0', () => console.log('Read-only dashboard UI fixture listening on 3210.'));
