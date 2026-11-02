-- One-off cleanup explicitly requested on 02/11/2026: bỏ nhãn ghi chú nội bộ
-- của đợt dữ liệu mô phỏng ([docs-YYYYMMDD], [docs-bookers-YYYYMMDD]) khỏi
-- bookings.note để màn hình quản trị không còn hiện câu ghi chú kỹ thuật.
-- Chỉ xoá đúng nhóm có nhãn; ghi chú thật của khách phải giữ nguyên.
-- Chạy bằng quyền quản trị SQL sau khi đã sao lưu. Mặc định ROLLBACK; chỉ thay
-- đúng dòng ROLLBACK cuối bằng COMMIT khi đã duyệt kết quả.
-- Không chạy tự động khi deploy và không đăng ký làm migration.
begin isolation level repeatable read;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(2026110202);
select set_config('request.jwt.claim.sub',(select p.id::text from profiles p join auth.users u on u.id=p.id
 where p.role='admin' and u.email not like '%@example.invalid' and (p.banned_until is null or p.banned_until<=now())
 order by p.created_at limit 1),true);

do $$ begin
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
end $$;

-- Số phận dữ liệu không được đổi: số đơn, tiền, trạng thái, số bản ghi thanh toán.
create temp table baseline on commit drop as
 select count(*) as orders,
        coalesce(sum(total_amount),0) as total,
        coalesce(sum(deposit_amount),0) as deposit,
        count(*) filter (where status='completed') as completed,
        count(*) filter (where status='cancelled') as cancelled,
        count(*) filter (where note like '[docs-%') as tagged_notes,
        count(*) filter (where note is not null and note not like '[docs-%') as kept_notes,
        (select count(*) from public.payments) as payments
 from public.bookings;

create temp table tagged on commit drop as
 select id, code, note from public.bookings where note like '[docs-%';

do $$
declare b record;
begin
  select * into b from baseline;
  -- Chỉ chạy trên đúng tập dữ liệu đã sao lưu: 60 đơn, 44 ghi chú có nhãn, 1 ghi chú thật.
  if b.orders <> 60 or b.tagged_notes <> 44 or b.kept_notes <> 1 then
    raise exception 'UNEXPECTED_BASELINE orders=% tagged=% kept=%',
      b.orders, b.tagged_notes, b.kept_notes;
  end if;
end $$;

update public.bookings b
set note = null
from tagged t
where b.id = t.id;

do $$
declare
  b record; v record; v_left bigint; v_kept bigint;
begin
  select * into b from baseline;
  select count(*) as orders,
         coalesce(sum(total_amount),0) as total,
         coalesce(sum(deposit_amount),0) as deposit,
         count(*) filter (where status='completed') as completed,
         count(*) filter (where status='cancelled') as cancelled,
         (select count(*) from public.payments) as payments
    into v from public.bookings;

  if v.orders <> b.orders or v.total <> b.total or v.deposit <> b.deposit
     or v.completed <> b.completed or v.cancelled <> b.cancelled or v.payments <> b.payments then
    raise exception 'BOOKING_FACTS_CHANGED';
  end if;

  select count(*) into v_left from public.bookings where note like '[docs-%';
  if v_left <> 0 then raise exception 'TAGGED_NOTES_LEFT %', v_left; end if;

  select count(*) into v_kept from public.bookings where note is not null;
  if v_kept <> b.kept_notes then raise exception 'REAL_NOTES_LOST %', v_kept; end if;

  select count(*) into v_left from public.bookings where note = '';
  if v_left <> 0 then raise exception 'EMPTY_NOTES_LEFT %', v_left; end if;
end $$;

select jsonb_pretty(jsonb_build_object(
  'marked_for_cleanup', (select count(*) from tagged),
  'notes_remaining', (select jsonb_agg(jsonb_build_object('code', code, 'note', note))
                      from public.bookings where note is not null),
  'orders', (select count(*) from public.bookings),
  'money', (select jsonb_build_object('total', sum(total_amount), 'deposit', sum(deposit_amount))
            from public.bookings)
)) as result;

rollback;
