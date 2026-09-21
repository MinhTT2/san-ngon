import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PitchNight } from '@/components/pitch-night';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Đăng nhập — Sân Ngon',
  description: 'Đăng nhập để đặt sân và xem lại đơn của bạn.',
};

/**
 * Hai cột: bên trái nói vì sao phải đăng nhập, bên phải là form.
 *
 * Bản cũ là một cột hẹp 448px giữa trang trắng, trông như trang lỗi. Người
 * tới đây đang bị chặn giữa luồng đặt sân, nên cột trái phải trả lời ngay
 * "đăng nhập để làm gì" chứ không bỏ họ nhìn vào một ô email trống.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const signupHref = next ? `/dang-ky?next=${encodeURIComponent(next)}` : '/dang-ky';

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16 lg:py-16">
      <div className="grid overflow-hidden rounded-[20px] border border-hairline bg-card lg:grid-cols-[1.05fr_1fr]">
        <Aside />
        <section className="flex flex-col justify-center gap-7 p-7 lg:p-12">
          <div className="flex flex-col gap-2.5">
            <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-tight text-pitch lg:text-[34px]">
              Đăng nhập để chốt sân
            </h1>
            <p className="text-[15px] leading-relaxed text-ink-secondary">
              Xem lịch thì không cần tài khoản. Chỉ khi đặt mới cần, để chủ sân biết ai đặt và gọi
              được nếu trời mưa hay đổi giờ.
            </p>
          </div>

          <Suspense fallback={<div className="h-64 animate-pulse rounded-control bg-sunk" />}>
            <LoginForm />
          </Suspense>

          <p className="border-t border-hairline pt-5 text-[13px] leading-relaxed text-ink-secondary">
            Chưa có tài khoản?{' '}
            <Link href={signupHref} className="font-semibold text-pitch underline underline-offset-2">
              Đăng ký bằng email
            </Link>
            <br />
            Bạn là chủ sân?{' '}
            <Link href="/dang-ky-san" className="font-semibold text-pitch underline underline-offset-2">
              Đăng sân của bạn
            </Link>{' '}
            — miễn phí, không ràng buộc.
          </p>
        </section>
      </div>
    </main>
  );
}

/** Cột trái: ảnh sân đêm + ba câu trả lời cho "đăng nhập rồi thì được gì". */
function Aside() {
  const points = [
    ['Giữ chỗ 15 phút', 'Đủ thời gian mở app ngân hàng mà không sợ mất khung giờ.'],
    ['Xem lại đơn bất cứ lúc nào', 'Mã đơn, giờ đá, số tiền còn phải trả tại sân.'],
    ['Hủy được khi kẹt', 'Báo sớm thì cọc được hoàn, khung giờ mở lại cho nhóm khác.'],
  ];

  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-pitch p-12 lg:flex">
      <PitchNight className="absolute inset-0 h-full w-full object-cover opacity-40" />
      {/* Lớp phủ đậm dần xuống dưới: phần trên còn thấy mặt sân, phần dưới đủ
          phẳng để danh sách đọc được mà không cần đổ bóng chữ. */}
      <div className="absolute inset-0 bg-gradient-to-b from-pitch/20 via-pitch/65 to-pitch" />

      <div className="relative flex flex-col gap-3">
        <span className="w-fit rounded-pill bg-[#16543F] px-3.5 py-1.5 text-[13px] font-medium text-[#A9C9B8]">
          Sân Ngon
        </span>
        <p className="max-w-sm font-display text-[26px] font-extrabold leading-[1.15] tracking-tight text-white">
          Sân trống tối nay, biết ngay trong 10 giây.
        </p>
      </div>

      <ul className="relative mt-12 flex flex-col gap-5">
        {points.map(([title, body]) => (
          <li key={title} className="flex gap-3.5">
            <Check />
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold text-white">{title}</span>
              <span className="text-sm leading-relaxed text-[#A9C9B8]">{body}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Check() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="mt-0.5 flex-none">
      <circle cx="10" cy="10" r="10" fill="#16543F" />
      <path d="M5.8 10.2l2.6 2.6 5.8-5.8" stroke="#9FC6B2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
