begin;
alter table public.feedback drop constraint feedback_category_check;
alter table public.feedback add constraint feedback_category_check check(category in ('bug','idea','support','report','privacy'));
alter table public.feedback add column data_request_action text check(data_request_action in ('access','correct','delete'));
alter table public.feedback add constraint privacy_request_action check((category='privacy')=(data_request_action is not null));
create function public.submit_data_request(p_id uuid,p_action text,p_message text)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing public.feedback;msg text:=btrim(p_message);heading text;
begin
 perform 1 from public.profiles where id=auth.uid() for update;
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_id is null or p_action is null or p_action not in ('access','correct','delete') or msg is null or length(msg) not between 20 and 3000 then raise exception 'INVALID_REQUEST' using errcode='22023';end if;
 select * into existing from public.feedback where id=p_id;
 if found then
  if existing.user_id=auth.uid() and existing.category='privacy' and existing.data_request_action=p_action and existing.message=msg then return existing.id;end if;
  raise exception 'FEEDBACK_CONFLICT' using errcode='22023';
 end if;
 if (select count(*) from public.feedback where user_id=auth.uid() and created_at>now()-interval '24 hours')>=5
  or (select count(*) from public.feedback where user_id=auth.uid() and status in ('new','reviewing'))>=10 then raise exception 'FEEDBACK_LIMIT' using errcode='22023';end if;
 heading:=case p_action when 'access' then 'Yêu cầu xem dữ liệu cá nhân' when 'correct' then 'Yêu cầu sửa dữ liệu cá nhân' else 'Yêu cầu xóa dữ liệu cá nhân' end;
 insert into public.feedback(id,user_id,category,data_request_action,title,message,page_path)
  values(p_id,auth.uid(),'privacy',p_action,heading,msg,'/tai-khoan/du-lieu');
 return p_id;
end $$;
create function public.guard_data_request_reply() returns trigger language plpgsql set search_path=public as $$
begin
 if new.category='privacy' and new.status in ('resolved','closed') and length(btrim(new.reply))<20 then raise exception 'PRIVACY_REPLY_REQUIRED' using errcode='22023';end if;return new;
end $$;
revoke all on function public.guard_data_request_reply() from public,anon,authenticated;
create trigger guard_data_request_reply before update on public.feedback for each row execute function public.guard_data_request_reply();
create function public.audit_data_request() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.category='privacy' then
  if tg_op='INSERT' then
   insert into public.operations_audit(actor_id,action,entity_id,details) values(auth.uid(),'privacy.requested',new.id,jsonb_build_object('request',new.data_request_action));
  elsif old.status is distinct from new.status then
   insert into public.operations_audit(actor_id,action,entity_id,details) values(auth.uid(),'privacy.status_changed',new.id,jsonb_build_object('from',old.status,'to',new.status));
  end if;
 end if;return new;
end $$;
revoke all on function public.audit_data_request() from public,anon,authenticated;
create trigger audit_data_request after insert or update on public.feedback for each row execute function public.audit_data_request();

create function public.get_my_data_export()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid:=auth.uid();answer jsonb;
begin
 if not public.account_active() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if (select count(*) from public.bookings where user_id=me)>1000
  or (select count(*) from public.tournament_registrations where user_id=me)>1000
  or (select count(*) from public.feedback where user_id=me)>1000
  or (select count(*) from public.notifications where user_id=me)>1000
  or (select count(*) from public.booking_refunds r join public.bookings b on b.id=r.booking_id where b.user_id=me)>1000
 then raise exception 'EXPORT_TOO_LARGE' using errcode='22023';end if;
 select jsonb_build_object('exported_at',now(),'scope','Dữ liệu tài khoản và hoạt động của chính bạn; không gồm tệp tải lên, toàn bộ sao kê hay dữ liệu khách của chủ sân.',
  'account',(select jsonb_build_object('id',p.id,'email',(select email from auth.users where id=me),'full_name',p.full_name,'phone',p.phone,'avatar_url',p.avatar_url,
   'role',p.role,'created_at',p.created_at,'owner_application_status',p.owner_application_status,'has_verification_document',p.business_license_path is not null) from public.profiles p where id=me),
  'community',(select to_jsonb(c) from public.community_profiles c where c.user_id=me),
  'bookings',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at,b.code) from(select code,customer_name,customer_phone,note,starts_at,ends_at,total_amount,deposit_amount,status,refund_status,created_at,paid_at from public.bookings where user_id=me)b),'[]'::jsonb),
  'booking_refunds',coalesce((select jsonb_agg(to_jsonb(r) order by r.transferred_at,r.reference) from(select b.code,r.amount,r.reference,r.transferred_at from public.booking_refunds r join public.bookings b on b.id=r.booking_id where b.user_id=me)r),'[]'::jsonb),
  'tournament_registrations',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at,r.code) from(select tournament_id,code,full_name,phone,address,team_name,note,status,entry_fee,deposit_amount,created_at,paid_at from public.tournament_registrations where user_id=me)r),'[]'::jsonb),
  'requests',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at,f.id) from(select id,category,data_request_action,title,message,status,reply,created_at,updated_at from public.feedback where user_id=me)f),'[]'::jsonb),
  'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at,n.id) from(select id,title,body,created_at from public.notifications where user_id=me)n),'[]'::jsonb)
 ) into answer;
 return answer;
end $$;

-- These are review thresholds, not automatic deletion or a legal retention claim.
create function public.get_retention_review(p_page int default 1)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare answer jsonb;
begin
 if not public.account_active() or not public.is_admin() then raise exception 'FORBIDDEN' using errcode='42501';end if;
 with candidates as materialized (
  select 'owner_document' kind,p.id,p.full_name label,r.created_at since from public.profiles p
   join lateral(select created_at,status from public.owner_application_reviews where owner_id=p.id order by created_at desc,id desc limit 1)r on true
   where p.owner_application_status='rejected' and r.status='rejected' and r.created_at<now()-interval '90 days' and p.business_license_path is not null
  union all
  select 'support',f.id,f.title,f.updated_at from public.feedback f where f.status in ('resolved','closed')
   and f.updated_at<now()-interval '180 days' and f.booking_id is null and f.receipt_path is null
 ), limits as(select count(*) total,greatest(1,ceil(count(*)/30.0)::int) pages,
  least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(count(*)/30.0)::int)) page from candidates),
 paged as(select * from candidates order by since,id limit 30 offset(select (page-1)*30 from limits))
 select jsonb_build_object('checked_at',now(),'total',l.total,'pages',l.pages,'page',l.page,
  'rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.since,p.id) from paged p),'[]'::jsonb)) into answer from limits l;
 return answer;
end $$;
revoke all on function public.submit_data_request(uuid,text,text),public.get_my_data_export(),public.get_retention_review(int) from public,anon;
grant execute on function public.submit_data_request(uuid,text,text),public.get_my_data_export(),public.get_retention_review(int) to authenticated;
notify pgrst,'reload schema';
commit;
