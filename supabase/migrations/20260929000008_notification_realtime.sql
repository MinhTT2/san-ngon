-- Some environments were bootstrapped before the inbox was added to realtime.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
   alter publication supabase_realtime add table public.notifications;
 end if;
end $$;
