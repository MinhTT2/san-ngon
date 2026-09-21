import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RegisterForm } from './register-form';
import { VenueStatusSteps } from './venue-status-steps';
import { BrandMark } from '@/components/brand-mark';
import type { OwnerVenue } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Đăng ký chủ sân · Sân Ngon' };

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let venues: OwnerVenue[] = [];
  let fullName: string | null = null;
  let phone: string | null = null;
  let loadFailed = false;

  if (user) {
    const [venueResult, profile] = await Promise.all([
      supabase.from('venues').select('id, slug, name, address, district, phone, status')
        .eq('owner_id', user.id).order('created_at').order('id'),
      supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    ]);
    venues = (venueResult.data ?? []) as OwnerVenue[];
    fullName = profile.data?.full_name ?? null;
    phone = profile.data?.phone ?? null;
    loadFailed = Boolean(venueResult.error);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 lg:px-16 lg:py-12">
      <div className="mb-8 flex items-center gap-2 text-xs text-ink-secondary">
        <Link href="/" className="hover:text-pitch">Trang chủ</Link>
        <span aria-hidden="true">/</span><span>Dành cho chủ sân</span>
      </div>
      {loadFailed ? (
        <div role="alert" className="rounded-card border border-hairline bg-card p-8">
          <h1 className="font-display text-2xl font-bold text-pitch">Chưa tải được hồ sơ của bạn</h1>
          <p className="mt-3 text-ink-secondary">Hãy tải lại trang để kiểm tra hồ sơ trước khi đăng ký.</p>
          <Link href="/dang-ky-san" className="mt-5 inline-block font-semibold text-pitch underline">Thử lại</Link>
        </div>
      ) : venues.length > 0 ? (
        <>
          <header className="mb-8 max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pitch">Dành cho chủ sân</p>
            <h1 className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-pitch sm:text-5xl">Các cụm sân của bạn.</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-ink-secondary">Theo dõi hồ sơ đang xác minh và đăng thêm cụm sân bằng cùng một tài khoản.</p>
          </header>
          <div className="flex max-w-3xl flex-col gap-8">
            {venues.map((venue) => <VenueStatusSteps key={venue.id} venue={venue} />)}
            <section className="rounded-card border border-hairline bg-card p-5 sm:p-8">
              <h2 className="font-display text-2xl font-bold tracking-tight text-pitch">Đăng thêm cụm sân</h2>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">Mỗi cụm sân có địa chỉ, lịch và hồ sơ giấy tờ riêng.</p>
              <div className="mt-7"><RegisterForm defaultName={fullName} defaultPhone={phone} /></div>
            </section>
          </div>
        </>
      ) : (
        <>
          <header className="mb-10 max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-pitch">Đồng hành cùng Sân Ngon</p>
            <h1 className="font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-pitch sm:text-5xl">Sân của bạn.<br />Sẵn sàng đón người chơi.</h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-ink-secondary">Đưa sân lên Sân Ngon để người chơi tìm thấy, xem lịch trống và đặt sân. Bắt đầu bằng vài thông tin về cụm sân của bạn.</p>
          </header>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
            {user ? <RegisterForm defaultName={fullName} defaultPhone={phone} /> : (
              <section className="rounded-card border border-hairline bg-card p-6 sm:p-10">
                <BrandMark size={44} />
                <h2 className="mt-6 font-display text-2xl font-bold text-pitch">Một tài khoản, quản lý các cụm sân</h2>
                <p className="mt-3 text-sm leading-7 text-ink-secondary">Đăng nhập để gửi hồ sơ và theo dõi kết quả xác minh. Tài khoản này cũng sẽ dùng để quản lý lịch và đơn đặt sân.</p>
                <Link href="/dang-nhap?next=/dang-ky-san" className="mt-7 inline-flex min-h-13 items-center justify-center gap-6 rounded-control bg-pitch px-6 font-semibold text-pitch-ink">Đăng nhập để bắt đầu <span aria-hidden="true">→</span></Link>
                <p className="mt-4 text-xs text-ink-secondary">Có thể dùng tài khoản Google hoặc email của bạn.</p>
                <div className="mt-8 border-t border-hairline pt-6">
                  <h3 className="text-sm font-semibold">Chuẩn bị trước khi đăng ký</h3>
                  <p className="mt-2 text-sm leading-7 text-ink-secondary">Địa chỉ và số liên hệ · Số sân và môn thể thao · Giờ mở cửa và giá thuê.</p>
                </div>
              </section>
            )}
            <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
              <section className="overflow-hidden rounded-card bg-pitch p-7 text-pitch-ink">
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-free-line">Từ sân trống đến lịch kín</span>
                <h2 className="mt-4 font-display text-2xl font-bold leading-tight">Bớt cuộc gọi.<br />Thêm thời gian cho sân.</h2>
                <ul className="mt-6 space-y-5 text-sm leading-6">
                  <li className="flex gap-3"><span aria-hidden="true" className="text-free-line">✓</span>Người chơi tự xem khung giờ còn trống.</li>
                  <li className="flex gap-3"><span aria-hidden="true" className="text-free-line">✓</span>Lịch và đơn đặt tập trung một nơi.</li>
                  <li className="flex gap-3"><span aria-hidden="true" className="text-free-line">✓</span>Giữ chỗ bằng tiền cọc chuyển khoản.</li>
                </ul>
              </section>
              <section className="rounded-card border border-hairline bg-card p-6">
                <h2 className="text-sm font-semibold">Sau khi gửi hồ sơ</h2>
                <ol className="mt-5 space-y-5">
                  {[
                    ['Tiếp nhận thông tin', 'Bạn theo dõi hồ sơ ngay trên trang này.'],
                    ['Liên hệ xác minh', 'Sân Ngon kiểm tra thông tin cùng bạn.'],
                    ['Mở lịch nhận khách', 'Chỉ khi được duyệt, sân mới xuất hiện công khai.'],
                  ].map(([title, body], i) => <li key={title} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-free-fill text-xs font-semibold text-pitch">{i + 1}</span><div><h3 className="text-sm font-medium">{title}</h3><p className="mt-1 text-xs leading-5 text-ink-secondary">{body}</p></div></li>)}
                </ol>
              </section>
              <p className="px-1 text-xs leading-6 text-ink-secondary">Cần trao đổi trước? <Link href="/lien-he" className="font-semibold text-pitch underline underline-offset-4">Liên hệ Sân Ngon</Link></p>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
