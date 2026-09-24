-- Run with: npx supabase db query --linked --file scripts/check-required-venue-photos.sql
-- All fixtures are rolled back. No bookings or notifications are created.
begin;
do $$
declare
  v_owner uuid; v_venue venues%rowtype; v_paths text[] := '{}'; v_path text;
begin
  select id into strict v_owner from profiles where role = 'owner'
    and owner_application_status = 'active' limit 1;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  select * into v_venue from create_venue('Kiểm tra ảnh rollback', 'Địa chỉ kiểm tra', 'Ba Đình',
    '0987654321', null, '05:00', '23:00',
    '[{"sport":"football5","court_count":1,"price_per_hour":250000}]');
  assert v_venue.status = 'draft', 'New venue must be private';
  assert not exists (select 1 from get_venue_availability(v_venue.id, current_date)), 'Draft has public slots';
  assert (search_venues(p_query => 'Kiểm tra ảnh rollback')->>'total')::int = 0, 'Draft appears in search';
  for i in 1..3 loop
    v_path := v_owner::text || '/' || v_venue.id::text || '/' || gen_random_uuid()::text || '.jpg';
    insert into storage.objects(bucket_id, name, metadata)
      values ('venue-photos', v_path, '{"mimetype":"image/jpeg","size":1024}');
    v_paths := array_append(v_paths, v_path);
  end loop;
  begin
    perform set_venue_images(v_venue.id, v_paths[1:2], '{}');
    raise exception 'CHECK_FAILED: two photos accepted';
  exception when raise_exception then if sqlerrm <> 'IMAGES_REQUIRED' then raise; end if; end;
  begin
    perform set_venue_images(v_venue.id, array[v_paths[1],v_paths[1],v_paths[2]], '{}');
    raise exception 'CHECK_FAILED: duplicate photos accepted';
  exception when raise_exception then if sqlerrm <> 'IMAGES_REQUIRED' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform set_venue_images(v_venue.id, v_paths, '{}');
    raise exception 'CHECK_FAILED: non-owner publish';
  exception when raise_exception then if sqlerrm <> 'VENUE_NOT_FOUND' then raise; end if; end;
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  begin
    perform set_venue_images(v_venue.id, array[v_paths[1],v_paths[2],replace(v_paths[3],v_venue.id::text,gen_random_uuid()::text)], '{}');
    raise exception 'CHECK_FAILED: missing object accepted';
  exception when raise_exception then if sqlerrm <> 'IMAGES_INVALID' then raise; end if; end;
  perform set_venue_images(v_venue.id, v_paths, '{}');
  assert exists (select 1 from venues where id = v_venue.id and status = 'active' and images = v_paths), 'Publish failed';
  assert (search_venues(p_query => 'Kiểm tra ảnh rollback')->>'total')::int = 1, 'Published venue missing';
  begin
    perform set_venue_images(v_venue.id, v_paths[1:2], v_paths);
    raise exception 'CHECK_FAILED: removed required photo';
  exception when raise_exception then if sqlerrm <> 'IMAGES_REQUIRED' then raise; end if; end;
  begin
    perform set_venue_images(v_venue.id, v_paths, '{}');
    raise exception 'CHECK_FAILED: stale edit accepted';
  exception when raise_exception then if sqlerrm <> 'IMAGES_CHANGED' then raise; end if; end;
end $$;
rollback;
