import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from '../dang-nhap/login-form';

export const metadata: Metadata = {
  title: 'Đăng ký tài khoản — Sân Ngon',
  description: 'Tạo tài khoản Sân Ngon để đặt sân và theo dõi đơn.',
};

export default function Page() {
  return (
    <main className="mx-auto max-w-lg px-5 py-10 lg:py-16">
      <section className="rounded-card border border-hairline bg-card p-7 lg:p-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch">
          Tạo tài khoản Sân Ngon
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">
          Đăng ký miễn phí bằng email. Không cần nhớ mật khẩu.
        </p>
        <div className="mt-7">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-control bg-sunk" />}>
            <LoginForm mode="signup" />
          </Suspense>
        </div>
        <p className="mt-7 border-t border-hairline pt-5 text-[13px] text-ink-secondary">
          Đã có tài khoản?{' '}
          <Link href="/dang-nhap" className="font-semibold text-pitch underline underline-offset-2">
            Đăng nhập
          </Link>
        </p>
      </section>
    </main>
  );
}
