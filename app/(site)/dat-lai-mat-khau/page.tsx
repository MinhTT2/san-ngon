import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PasswordResetForm } from '@/components/password-reset-form';

export const metadata: Metadata = { title: 'Đặt lại mật khẩu — Sân Ngon' };

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/quen-mat-khau?loi=1');
  return <main className="mx-auto max-w-lg px-5 py-12"><section className="space-y-6 rounded-card border border-hairline bg-card p-6">
    <h1 className="font-display text-3xl font-bold text-pitch">Đặt mật khẩu mới</h1>
    <p className="text-sm leading-6 text-ink-secondary">Mật khẩu mới sẽ dùng cho tài khoản {user.email}.</p>
    <PasswordResetForm mode="update" />
  </section></main>;
}
