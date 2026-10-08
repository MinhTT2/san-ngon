import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VenueManagement } from './venue-management';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ venue?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san/quan-ly');
  const { venue: selectedVenueId } = await searchParams;
  const { data: profile } = await supabase.from('profiles').select('role, owner_application_status, phone').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'owner' || profile.owner_application_status !== 'active') redirect('/dang-ky-san');

  const { data, error } = await supabase
    .from('venues')
    .select('id, name, address, district, phone, description, images, open_time, close_time, deposit_pct, booking_horizon_days, status, courts(id, name, sport, surface, is_indoor, slot_minutes, open_time, close_time, is_active, sort_order, price_rules(price_per_hour, start_time, end_time, label))')
    .eq('owner_id', user.id)
    .order('created_at')
    .order('id');
  if (error) throw new Error('Không tải được dữ liệu quản lý sân. Vui lòng thử lại.');
  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><DashboardPageHeader eyebrow="Chủ sân / Quản lý" title="Cụm sân và sân con" description="Cập nhật thông tin, ảnh và bảng giá. Đơn đã phát sinh được giữ lại khi tắt sân." /><div className="mt-5"><VenueManagement initialVenues={(data ?? []) as unknown as Parameters<typeof VenueManagement>[0]['initialVenues']} selectedVenueId={selectedVenueId} defaultPhone={profile.phone} /></div></main>;
}
