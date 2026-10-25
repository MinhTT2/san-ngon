begin;
create table public.operational_alerts (
 check_key text primary key,
 title text not null,
 is_open boolean not null,
 opened_at timestamptz,
 resolved_at timestamptz,
 last_seen_at timestamptz not null default now()
);
alter table public.operational_alerts enable row level security;
revoke all on public.operational_alerts from public,anon,authenticated;

create function public.operational_health_snapshot()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare checks jsonb:='[]'; expected record; job_id bigint; enabled boolean; run_status text; run_at timestamptz;
 amount bigint; configured boolean; http_status int; http_at timestamptz;
begin
 for expected in select * from (values
  ('expire-pending-bookings','Dọn giữ chỗ hết hạn',interval '5 minutes'),
  ('complete-past-bookings','Hoàn tất buổi chơi',interval '90 minutes'),
  ('tournament-deadlines','Hạn giải đấu',interval '5 minutes'),
  ('notification-delivery','Lịch gửi thông báo',interval '5 minutes')
 ) e(name,title,max_age) loop
  select jobid,active into job_id,enabled from cron.job where jobname=expected.name;
  select status,start_time into run_status,run_at from cron.job_run_details where jobid=job_id order by runid desc limit 1;
  checks:=checks||jsonb_build_array(jsonb_build_object('key','cron:'||expected.name,'title',expected.title,
   'ok',coalesce(enabled and run_status in ('succeeded','running','starting') and run_at>now()-expected.max_age,false),
   'detail',case when job_id is null then 'Chưa có lịch chạy' when not enabled then 'Lịch đang tắt'
    when run_at is null then 'Chưa ghi nhận lượt chạy' when run_status='failed' then 'Lượt chạy gần nhất thất bại'
    when run_at<=now()-expected.max_age then 'Chưa có lượt chạy mới trong thời gian dự kiến' else 'Đang chạy đúng lịch' end,
   'last_run_at',run_at));
 end loop;
 configured:=exists(select 1 from public.notification_worker_config);
 if to_regclass('net._http_response') is not null then
  execute 'select h.status_code,r.created_at from public.notification_worker_requests r join net._http_response h on h.id=r.request_id order by r.created_at desc limit 1'
   into http_status,http_at;
 end if;
 checks:=checks||jsonb_build_array(jsonb_build_object('key','worker:http','title','Kết nối worker gửi tin',
  'ok',coalesce(configured and http_status=200 and http_at>now()-interval '5 minutes',false),
  'detail',case when not configured then 'Chưa cấu hình worker' when http_at is null then 'Chưa nhận phản hồi worker'
   when http_status is distinct from 200 then 'Worker chưa xử lý thành công lượt gọi gần nhất'
   when http_at<=now()-interval '5 minutes' then 'Phản hồi worker đã cũ' else 'Worker đang phản hồi thành công' end,'last_run_at',http_at));
 select count(*) into amount from public.notification_deliveries where status='failed';
 checks:=checks||jsonb_build_array(jsonb_build_object('key','notifications:failed','title','Thông báo gửi thất bại','ok',amount=0,'count',amount,
  'detail',case when amount=0 then 'Không có tác vụ gửi lỗi cần xử lý' else 'Kiểm tra cấu hình/kênh nhận rồi đưa lại vào hàng đợi khi phù hợp' end));
 select count(*) into amount from public.notification_deliveries where
  (status='pending' and available_at<=now() and created_at<now()-interval '10 minutes') or
  (status='processing' and lease_until<now()-interval '3 minutes');
 checks:=checks||jsonb_build_array(jsonb_build_object('key','notifications:backlog','title','Tác vụ gửi đang tồn','ok',amount=0,'count',amount,
  'detail',case when amount=0 then 'Không có tác vụ quá thời gian chờ dự kiến' else 'Có tác vụ đến lượt nhưng chưa được xử lý kịp' end));
 select count(*) into amount from public.sepay_connections c join public.profiles p on p.id=c.owner_id
  where c.status='reconnect' and p.owner_application_status='active' and exists(select 1 from public.venues v where v.owner_id=p.id and v.status='active');
 checks:=checks||jsonb_build_array(jsonb_build_object('key','sepay:reconnect','title','Kết nối SePay cần cấp quyền lại','ok',amount=0,'count',amount,
  'detail',case when amount=0 then 'Không có chủ sân hoạt động bị yêu cầu kết nối lại' else 'Liên hệ chủ sân để cấp lại quyền trong Tài khoản nhận cọc' end));
 select count(*) into amount from public.incoming_transfers where expected_amount is not null and needs_review
  and source in ('booking','tournament','subscription') and created_at<now()-interval '24 hours';
 checks:=checks||jsonb_build_array(jsonb_build_object('key','transfers:review','title','Giao dịch được gắn cờ đối soát lâu','ok',amount=0,'count',amount,
  'detail',case when amount=0 then 'Không có giao dịch nhận diện được đang gắn cờ quá 24 giờ' else 'Mở Sổ tiền vào để đối soát các giao dịch đã xác định người nhận' end));
 return jsonb_build_object('checked_at',now(),'checks',checks,
  'monitor_active',exists(select 1 from cron.job where jobname='operational-health' and active),
  'monitor_recent',coalesce((select max(last_seen_at)>now()-interval '12 minutes' from public.operational_alerts),false),
  'monitor_last_seen_at',(select max(last_seen_at) from public.operational_alerts));
end $$;
revoke all on function public.operational_health_snapshot() from public,anon,authenticated;

create function public.get_operational_health()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
 if not public.account_active() or not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return public.operational_health_snapshot();
end $$;
revoke all on function public.get_operational_health() from public,anon;
grant execute on function public.get_operational_health() to authenticated;

create function public.refresh_operational_alerts()
returns int language plpgsql security definer set search_path=public as $$
declare snapshot jsonb; item jsonb; prior public.operational_alerts; opened boolean; changed boolean; notified int:=0;
begin
 if not pg_try_advisory_xact_lock(hashtext('san-ngon:operational-alerts')) then return 0;end if;
 snapshot:=public.operational_health_snapshot();
 for item in select value from jsonb_array_elements(snapshot->'checks') loop
  opened:=not (item->>'ok')::boolean;
  select * into prior from public.operational_alerts where check_key=item->>'key' for update;
  changed:=case when found then prior.is_open is distinct from opened else opened end;
  insert into public.operational_alerts(check_key,title,is_open,opened_at,resolved_at,last_seen_at)
   values(item->>'key',item->>'title',opened,case when opened then now() end,case when not opened then now() end,now())
   on conflict(check_key) do update set is_open=excluded.is_open,
    opened_at=case when excluded.is_open and not operational_alerts.is_open then now() else operational_alerts.opened_at end,
    resolved_at=case when excluded.is_open then null when operational_alerts.is_open then now() else operational_alerts.resolved_at end,last_seen_at=now();
  if changed then
   insert into public.notifications(user_id,kind,channel,title,body)
    select p.id,'new_booking','app',case when opened then 'Vận hành cần kiểm tra: ' else 'Vận hành đã phục hồi: ' end||(item->>'title'),
     (item->>'detail')||'. Mở Quản trị → Vận hành để kiểm tra.' from public.profiles p
    where p.role='admin' and (p.banned_until is null or p.banned_until<=now());
   notified:=notified+1;
  end if;
 end loop;
 return notified;
end $$;
revoke all on function public.refresh_operational_alerts() from public,anon,authenticated;
grant execute on function public.refresh_operational_alerts() to service_role;
select cron.schedule('operational-health','*/5 * * * *','select public.refresh_operational_alerts()');
notify pgrst,'reload schema';
commit;
