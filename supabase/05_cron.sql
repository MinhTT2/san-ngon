-- ============================================================
-- Sân Ngon — 05. Tác vụ nền và Realtime
-- Bật extension pg_cron ở Database > Extensions trước khi chạy.
-- ============================================================

select cron.schedule('expire-pending-bookings', '*/2 * * * *',
  $$ select expire_pending_bookings() $$);

select cron.schedule('complete-past-bookings', '15 * * * *',
  $$ select complete_past_bookings() $$);

-- Lịch tự cập nhật khi có người khác đặt
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table notifications;

-- Kiểm tra: select * from cron.job;
