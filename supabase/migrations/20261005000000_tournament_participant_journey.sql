create or replace function public.get_my_tournament_registrations(p_page int default 1)
returns jsonb language sql stable security definer set search_path=public as $$
  with latest as (
    select distinct on(r.tournament_id)
      r.id,r.tournament_id,r.status,r.paid_at,r.deposit_amount,r.entry_fee,r.payment_expires_at,r.created_at,
      t.title,t.sport,t.address,t.starts_at,t.ends_at,t.registration_deadline,t.status as tournament_status
    from tournament_registrations r join tournaments t on t.id=r.tournament_id
    where r.user_id=auth.uid()
    order by r.tournament_id,r.created_at desc,r.id desc
  ) select jsonb_build_object(
    'total',(select count(*) from latest),
    'rows',coalesce((select jsonb_agg(to_jsonb(result) order by result.created_at desc,result.id desc) from (
      select id,tournament_id,case
        when status='pending' and registration_deadline<=now() then 'expired'
        when status='approved' and deposit_amount>0 and paid_at is null and payment_expires_at<=now() then 'expired'
        else status end as status,
        paid_at,deposit_amount,entry_fee,payment_expires_at,created_at,
        title,sport,address,starts_at,ends_at,registration_deadline,tournament_status
      from latest order by created_at desc,id desc
      limit 12 offset (greatest(1,least(coalesce(p_page,1),10000))-1)*12
    ) result),'[]'::jsonb)
  );
$$;
revoke all on function public.get_my_tournament_registrations(int) from public,anon;
grant execute on function public.get_my_tournament_registrations(int) to authenticated;
notify pgrst,'reload schema';
