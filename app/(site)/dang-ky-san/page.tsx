import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RegisterForm } from './register-form';
import { OwnerStatusSteps } from './venue-status-steps';
import { BrandMark } from '@/components/brand-mark';
import type { OwnerVenue } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Đăng ký chủ sân · Sân Ngon' };

type OwnerProfile = { full_name: string | null; phone: string | null; role: string; owner_application_status: string | null };

export default async function Page({ searchParams }: { searchParams: Promise<{ resubmit?: string }> }) {
  const { resubmit } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let profile: OwnerProfile | null = null;
  let venues: OwnerVenue[] = [];
  let loadFailed = false;
  if (user) {
    const [{ data, error: profileError }, { data: venueRows, error: venueError }] = await Promise.all([
      supabase.from('profiles').select('full_name, phone, role, owner_application_status').eq('id', user.id).maybeSingle(),
      supabase.from('venues').select('id, slug, name, address, district, phone, status').eq('owner_id', user.id).order('created_at').order('id'),
    ]);
    profile = data as OwnerProfile | null;
    venues = (venueRows ?? []) as OwnerVenue[];
    loadFailed = Boolean(profileError || venueError);
  }
  const approved = profile?.owner_application_status === 'active';

  return <main className="mx-auto max-w-7xl px-5 py-8 lg:px-16 lg:py-12"><div className="mb-8 flex items-center gap-2 text-xs text-ink-secondary"><Link href="/" className="hover:text-pitch">Trang chủ</Link><span aria-hidden="true">/</span><span>Dành cho chủ sân</span></div>{loadFailed ? <section className="rounded-card border border-hairline bg-card p-8"><h1 className="font-display text-2xl font-bold text-pitch">Chưa tải được hồ sơ của bạn</h1><p className="mt-3 text-ink-secondary">Hãy tải lại trang để kiểm tra lại trạng thái.</p></section> : !user ? <LoginCard /> : !approved ? <OwnerStatusOrForm profile={profile} resubmit={resubmit === '1'} /> : <ApprovedOwner venues={venues} />}</main>;
}

function OwnerStatusOrForm({ profile, resubmit }: { profile: OwnerProfile | null; resubmit: boolean }) {
  if (profile?.owner_application_status === 'pending') return <OwnerStatusSteps status="pending" />;
  if (profile?.owner_application_status === 'rejected' && !resubmit) return <OwnerStatusSteps status="rejected" />;
  return <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10"><div><header className="mb-10 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pitch">Đồng hành cùng Sân Ngon</p><h1 className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-pitch sm:text-5xl">Trở thành chủ sân.</h1><p className="mt-5 max-w-xl text-[15px] leading-7 text-ink-secondary">Gửi thông tin xác minh trước. Khi được duyệt, bạn mới tạo cụm sân và thêm các sân con.</p></header><RegisterForm defaultName={profile?.full_name} defaultPhone={profile?.phone} /></div><aside className="rounded-card bg-pitch p-7 text-pitch-ink"><span className="text-xs font-medium uppercase tracking-[0.16em] text-free-line">Quy trình đơn giản</span><h2 className="mt-4 font-display text-2xl font-bold">Duyệt tài khoản trước, đăng sân sau.</h2><p className="mt-3 text-sm leading-6 text-pitch-ink/75">Sân Ngon kiểm tra thông tin và giấy tờ. Sau đó bạn tự tạo từng cụm sân, môn thể thao và giá thuê.</p></aside></div>;
}

function ApprovedOwner({ venues }: { venues: OwnerVenue[] }) {
  return <><header className="mb-8 max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pitch">Dành cho chủ sân</p><h1 className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-pitch sm:text-5xl">Tài khoản chủ sân đã được duyệt.</h1><p className="mt-5 max-w-xl text-[15px] leading-7 text-ink-secondary">Tạo cụm sân, thêm sân con và quản lý lịch đặt từ trang quản lý.</p></header><section className="max-w-3xl rounded-card border border-hairline bg-card p-5 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-2xl font-bold text-pitch">Các cụm sân của bạn</h2><p className="mt-2 text-sm text-ink-secondary">{venues.length ? 'Chọn một cụm sân để xem lịch.' : 'Bạn chưa tạo cụm sân nào.'}</p></div><Link href="/chu-san/quan-ly" className="inline-flex min-h-12 items-center rounded-control bg-pitch px-5 font-semibold text-pitch-ink">+ Tạo cụm sân</Link></div>{venues.length > 0 && <ul className="mt-6 divide-y divide-hairline border-t border-hairline">{venues.map((venue) => <li key={venue.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-pitch">{venue.name}</p><p className="mt-1 text-sm text-ink-secondary">{venue.address} · {venue.district}</p></div><Link href={`/san/${venue.slug}`} className="text-sm font-semibold text-pitch underline">Xem trang sân</Link></li>)}</ul>}</section></>;
}

function LoginCard() { return <section className="max-w-2xl rounded-card border border-hairline bg-card p-6 sm:p-10"><BrandMark size={44} /><h1 className="mt-6 font-display text-3xl font-bold text-pitch">Đăng ký làm chủ sân</h1><p className="mt-3 text-sm leading-7 text-ink-secondary">Đăng nhập để gửi hồ sơ xác minh. Sau khi được duyệt, bạn sẽ tạo cụm sân trong trang quản lý.</p><Link href="/dang-nhap?next=/dang-ky-san" className="mt-7 inline-flex min-h-13 items-center rounded-control bg-pitch px-6 font-semibold text-pitch-ink">Đăng nhập để bắt đầu <span aria-hidden="true" className="ml-4">→</span></Link></section>; }
