-- ============================================================
-- Sân Ngon — 02. Row Level Security
-- ============================================================

alter table profiles      enable row level security;
alter table venues        enable row level security;
alter table courts        enable row level security;
alter table price_rules   enable row level security;
alter table bookings      enable row level security;
alter table payments      enable row level security;
alter table notifications enable row level security;

create or replace function owns_court(p_court_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from courts c join venues v on v.id = c.venue_id
    where c.id = p_court_id and v.owner_id = auth.uid()
  );
$$;

-- profiles
drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles for select using (id = auth.uid());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- venues: công khai khi active, chủ sân thấy cả hồ sơ chờ duyệt của mình
drop policy if exists venues_read on venues;
create policy venues_read on venues for select
  using (status = 'active' or owner_id = auth.uid());

drop policy if exists venues_owner_write on venues;
-- Hồ sơ được tạo bởi register_venue() (security definer). Chủ sân chỉ được
-- sửa thông tin khi còn chờ duyệt và không thể tự đổi status thành active.
create policy venues_owner_update_pending on venues for update
  using (owner_id = auth.uid() and status = 'pending')
  with check (owner_id = auth.uid() and status = 'pending');

-- courts
drop policy if exists courts_read on courts;
create policy courts_read on courts for select using (
  exists (select 1 from venues v where v.id = venue_id
          and (v.status = 'active' or v.owner_id = auth.uid()))
);

drop policy if exists courts_owner_write on courts;
create policy courts_owner_write on courts for all
  using (exists (select 1 from venues v where v.id = venue_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from venues v where v.id = venue_id and v.owner_id = auth.uid()));

-- price_rules
drop policy if exists price_rules_read on price_rules;
create policy price_rules_read on price_rules for select using (true);

drop policy if exists price_rules_owner_write on price_rules;
create policy price_rules_owner_write on price_rules for all
  using (owns_court(court_id)) with check (owns_court(court_id));

-- bookings
drop policy if exists bookings_update_owner on bookings;
drop policy if exists bookings_select on bookings;
create policy bookings_select on bookings for select
  using (user_id = auth.uid() or owns_court(court_id));

drop policy if exists bookings_insert_own on bookings;
create policy bookings_insert_own on bookings for insert
  with check (user_id = auth.uid());

-- Người đặt KHÔNG được update thẳng dòng đơn của mình. Chính sách cũ chỉ có
-- USING mà không có WITH CHECK, nghĩa là từ trình duyệt họ tự đổi được
-- status thành 'confirmed' hoặc hạ total_amount mà không cần trả đồng nào.
-- Hủy đơn đi qua hàm cancel_booking(), sửa trạng thái đi qua webhook.
drop policy if exists bookings_update on bookings;
create policy bookings_update_owner on bookings for update
  using (owns_court(court_id)) with check (owns_court(court_id));

-- payments: chỉ đọc, ghi hoàn toàn bằng service role trong webhook
drop policy if exists payments_select on payments;
create policy payments_select on payments for select using (
  exists (select 1 from bookings b where b.id = booking_id
          and (b.user_id = auth.uid() or owns_court(b.court_id)))
);

-- notifications: chỉ thấy của mình, chỉ được đánh dấu đã đọc
drop policy if exists notif_select on notifications;
create policy notif_select on notifications for select using (user_id = auth.uid());

drop policy if exists notif_update_read on notifications;
create policy notif_update_read on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
