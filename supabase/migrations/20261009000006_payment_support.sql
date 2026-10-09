begin;
alter table public.feedback add column booking_id uuid references public.bookings(id) on delete restrict;
alter table public.feedback add column receipt_path text;
alter table public.feedback add constraint feedback_receipt_booking check (receipt_path is null or booking_id is not null);
create unique index feedback_receipt_unique on public.feedback(receipt_path) where receipt_path is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-receipts','payment-receipts',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy payment_receipts_insert on storage.objects for insert to authenticated
with check(bucket_id='payment-receipts' and public.account_active()
  and name ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}[.](jpg|png|webp)$'));
create policy payment_receipts_select on storage.objects for select to authenticated
using(bucket_id='payment-receipts' and public.account_active()
  and ((storage.foldername(name))[1]=auth.uid()::text or public.is_admin()));
create policy payment_receipts_delete on storage.objects for delete to authenticated
using(bucket_id='payment-receipts' and public.account_active()
  and (storage.foldername(name))[1]=auth.uid()::text
  and not exists(select 1 from public.feedback f where f.receipt_path=storage.objects.name));

create function public.submit_payment_support(p_id uuid,p_code text,p_message text,p_receipt_path text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings; f public.feedback; v_title text; v_id uuid;
begin
  perform 1 from public.profiles where id=auth.uid() for update;
  if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into b from public.bookings where code=upper(btrim(p_code)) and user_id=auth.uid();
  if not found then raise exception 'BOOKING_NOT_FOUND' using errcode='22023'; end if;
  if p_receipt_path is not null and (
    p_receipt_path !~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}[.](jpg|png|webp)$')
    or not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=p_receipt_path)
  ) then raise exception 'INVALID_RECEIPT' using errcode='22023'; end if;
  v_title := 'Hỗ trợ chuyển khoản '||b.code;
  select * into f from public.feedback where id=p_id;
  if found and (f.booking_id is distinct from b.id or f.receipt_path is distinct from p_receipt_path) then
    raise exception 'FEEDBACK_CONFLICT' using errcode='22023';
  end if;
  v_id := public.submit_feedback(p_id,'support',v_title,p_message,'/dat-san/'||b.code);
  update public.feedback set booking_id=b.id,receipt_path=p_receipt_path where id=v_id;
  return v_id;
end $$;
revoke all on function public.submit_payment_support(uuid,text,text,text) from public,anon;
grant execute on function public.submit_payment_support(uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
