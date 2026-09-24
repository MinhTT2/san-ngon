-- The original policy resolved the unqualified `name` to venues.name inside
-- the EXISTS query, so every upload path was rejected.
drop policy if exists venue_photos_insert on storage.objects;
create policy venue_photos_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'venue-photos'
  and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  and exists (
    select 1 from public.venues v
    where v.id::text = (storage.foldername(storage.objects.name))[2]
      and v.owner_id = auth.uid()
  )
  and storage.objects.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'
);
