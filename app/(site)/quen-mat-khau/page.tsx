import type { Metadata } from 'next';
import { PasswordResetForm } from '@/components/password-reset-form';

export const metadata: Metadata = { title: 'Quên mật khẩu — Sân Ngon' };

export default async function Page({ searchParams }: { searchParams: Promise<{ loi?: string }> }) {
  const { loi } = await searchParams;
  return <main className="mx-auto max-w-lg px-5 py-12"><section className="space-y-6 rounded-card border border-hairline bg-card p-6">
    <h1 className="font-display text-3xl font-bold text-pitch">Quên mật khẩu?</h1>
    <p className="text-sm leading-6 text-ink-secondary">Nhập email đã đăng ký để nhận liên kết tạo mật khẩu mới.</p>
    {loi && <p role="alert" className="text-sm text-danger">Liên kết không hợp lệ, đã hết hạn hoặc được mở ở trình duyệt khác. Hãy yêu cầu email mới và mở tại trình duyệt này.</p>}
    <PasswordResetForm mode="request" />
  </section></main>;
}
