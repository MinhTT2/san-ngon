import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Thông tin tài khoản' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/tai-khoan');

  const { data: profile, error } = await supabase.from('profiles')
    .select('full_name, phone').eq('id', user.id).maybeSingle();

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-16 lg:py-12">
      <Link href="/" className="text-sm text-ink-secondary hover:text-pitch">← Trang chủ</Link>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-pitch sm:text-4xl">Thông tin tài khoản</h1>
      <p className="mt-3 text-sm leading-6 text-ink-secondary">Cập nhật thông tin liên hệ để đặt sân nhanh hơn.</p>
      {error || !profile ? (
        <p role="alert" className="mt-8 rounded-card border border-hairline bg-card p-6 text-sm text-danger">
          Chưa tải được thông tin tài khoản. Vui lòng tải lại trang.
        </p>
      ) : <ProfileForm fullName={profile.full_name ?? ''} phone={profile.phone ?? ''} email={user.email ?? ''} />}
    </main>
  );
}
