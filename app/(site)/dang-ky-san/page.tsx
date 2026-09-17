import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { RegisterForm } from './register-form';
import { VenueStatusSteps } from './venue-status-steps';
import type { OwnerVenue } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Một trang, hai trạng thái: chưa có hồ sơ thì hiện form, có rồi thì hiện
 * bốn bước duyệt. Chủ sân bấm lại link "Đăng sân" trong header sẽ thấy hồ sơ
 * của mình chứ không phải form trắng — đó là câu hỏi họ thực sự có.
 */
export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let venue: OwnerVenue | null = null;
  let profile: { full_name: string | null; phone: string | null } | null = null;

  if (user) {
    const [{ data: v }, { data: p }] = await Promise.all([
      supabase
        .from('venues')
        .select('id, slug, name, address, district, phone, status')
        .eq('owner_id', user.id)
        .maybeSingle(),
      supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    ]);
    venue = v as OwnerVenue | null;
    profile = p;
  }

  if (venue) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-12 lg:px-16">
        <VenueStatusSteps venue={venue} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch lg:text-4xl">
        Đăng sân của bạn
      </h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
        Điền một lần, chúng tôi gọi lại trong vòng một ngày làm việc để xác minh rồi mở lịch.
        Miễn phí, không ràng buộc, gỡ sân bất cứ lúc nào.
      </p>

      {!user ? (
        <div className="mt-8 flex flex-col items-start gap-4 rounded-card border border-strong bg-free-fill p-6">
          <p className="text-[15px] leading-relaxed">
            Đăng nhập trước đã — hồ sơ cần gắn với một tài khoản để bạn quản lý lịch sau này.
          </p>
          <Link
            href="/dang-nhap?next=/dang-ky-san"
            className="flex h-13 items-center rounded-control bg-pitch px-7 font-semibold text-pitch-ink"
          >
            Đăng nhập rồi đăng sân
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <RegisterForm defaultPhone={profile?.phone} />
        </div>
      )}

      <section className="mt-12 border-t border-hairline pt-8">
        <h2 className="text-[15px] font-semibold">Chúng tôi cần gì ở bạn</h2>
        <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-relaxed text-ink-secondary">
          <li>· Một số điện thoại có người nghe, để khách gọi khi tới nơi.</li>
          <li>· Tài khoản ngân hàng nhận cọc — chúng tôi chuyển thẳng, không giữ tiền của bạn.</li>
          <li>· Giá thuê một giờ. Tách giờ vàng, giờ đêm, cuối tuần sau khi hồ sơ được duyệt.</li>
        </ul>
      </section>
    </main>
  );
}
