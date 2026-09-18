-- ============================================================
-- Sân Ngon — 05. Tác vụ nền và Realtime
-- Bật extension pg_cron ở Database > Extensions trước khi chạy.
-- ============================================================

do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'expire-pending-bookings') then
    perform cron.unschedule('expire-pending-bookings');
  end if;
  if exists (select 1 from cron.job where jobname = 'complete-past-bookings') then
    perform cron.unschedule('complete-past-bookings');
  end if;
  perform cron.schedule('expire-pending-bookings', '*/2 * * * *',
    $$ select expire_pending_bookings() $$);
  perform cron.schedule('complete-past-bookings', '15 * * * *',
    $$ select complete_past_bookings() $$);
end $cron$;

-- Lịch tự cập nhật khi có người khác đặt
do $$
declare t text;
begin
  foreach t in array array['bookings', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Kiểm tra: select * from cron.job;
