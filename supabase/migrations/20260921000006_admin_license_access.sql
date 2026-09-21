-- Admin cần xem giấy phép riêng tư để kiểm tra trước khi duyệt hồ sơ.
drop policy if exists venue_documents_admin_select on storage.objects;
create policy venue_documents_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'venue-documents' and public.is_admin());
