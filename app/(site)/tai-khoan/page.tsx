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
    .select('full_name, phone, avatar_url, role').eq('id', user.id).maybeSingle();

  return (
    <main className="profile-page mx-auto w-full max-w-7xl px-5 py-8 lg:px-16 lg:py-12">
      <nav aria-label="Đường dẫn" className="flex items-center gap-3 text-xs text-ink-secondary"><Link href="/" className="hover:text-pitch">Trang chủ</Link><span aria-hidden="true">/</span><span aria-current="page">Thông tin tài khoản</span></nav>
      <header className="profile-enter my-8 flex items-end justify-between gap-5 lg:my-10">
        <div><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-secondary">Không gian của bạn</p><h1 className="font-display text-4xl font-extrabold tracking-tight text-pitch sm:text-5xl">Hồ sơ của bạn<span className="text-success">.</span></h1><p className="mt-4 max-w-lg text-sm leading-6 text-ink-secondary">Một chút về bạn. Sẵn sàng cho những cuộc hẹn trên sân.</p></div>
        <span className="hidden pb-1 font-display text-sm font-bold text-pitch md:block">Gặp nhau trên sân ↗</span>
      </header>
      {error || !profile ? (
        <p role="alert" className="mt-8 rounded-card border border-hairline bg-card p-6 text-sm text-danger">
          Chưa tải được thông tin tài khoản. Vui lòng tải lại trang.
        </p>
      ) : <ProfileForm userId={user.id} fullName={profile.full_name ?? ''} phone={profile.phone ?? ''} email={user.email ?? ''} avatar={profile.avatar_url} role={profile.role} />}
    </main>
  );
}
