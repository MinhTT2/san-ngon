-- One-off presentation cleanup of generated bookings; never payment confirmation.
-- Keep provenance and the original note in the immutable admin audit log.
begin;
select pg_advisory_xact_lock(20261025,40);
create temporary table booking_presentation_before on commit drop as
select id,note,status,paid_at,total_amount,deposit_amount from public.bookings;
create temporary table booking_payments_before on commit drop as select * from public.payments;
insert into public.operations_audit(action,entity_id,entity_code,details)
select 'booking.seed_presentation_updated',b.id,b.code,
  jsonb_build_object('source','generated_history','original_note',b.note,'new_note',null)
from public.bookings b
where b.note in ('[demo-report-20261025] Dữ liệu demo, không phải giao dịch ngân hàng',
  'Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng')
  and not exists(select 1 from public.operations_audit a where a.entity_id=b.id
    and a.action='booking.seed_presentation_updated');
update public.bookings set note=null
where note in ('[demo-report-20261025] Dữ liệu demo, không phải giao dịch ngân hàng',
  'Docs 2026-10-19 · Dữ liệu demo, không phải giao dịch ngân hàng');
do $$ begin
  assert not exists(select id,status,paid_at,total_amount,deposit_amount from bookings
    except select id,status,paid_at,total_amount,deposit_amount from booking_presentation_before), 'Booking finances changed';
  assert not exists(select * from payments except select * from booking_payments_before)
    and not exists(select * from booking_payments_before except select * from payments), 'Payments changed';
  assert (select count(*) from bookings)=(select count(*) from booking_presentation_before), 'Booking count changed';
  assert not exists(select 1 from bookings b join operations_audit a on a.entity_id=b.id
    where a.action='booking.seed_presentation_updated' and b.note is not null), 'Generated label remains';
end $$;
commit;
select count(*) as total_bookings,
  count(*) filter(where note ilike '%demo%') as visible_demo_notes,
  (select count(*) from operations_audit where action='booking.seed_presentation_updated') as preserved_sources
from bookings;
