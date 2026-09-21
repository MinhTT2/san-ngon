import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VenueForm } from './venue-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tạo cụm sân · Sân Ngon' };

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/tao-cum-san');
  const { data: profile } = await supabase.from('profiles').select('role, owner_application_status, phone').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'owner' || profile.owner_application_status !== 'active') redirect('/dang-ky-san');

  return <main className="mx-auto max-w-4xl px-5 py-10 lg:px-16"><Link href="/chu-san" className="text-sm text-ink-secondary hover:text-pitch">← Quay lại trang quản lý</Link><header className="mt-8 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-pitch">Cụm sân mới</p><h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-pitch">Tạo cụm sân và thêm sân con.</h1><p className="mt-4 text-[15px] leading-7 text-ink-secondary">Sau khi lưu, cụm sân và lịch trống sẽ sẵn sàng để bạn quản lý.</p></header><div className="mt-8"><VenueForm defaultPhone={profile.phone} /></div></main>;
}
