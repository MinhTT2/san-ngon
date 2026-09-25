import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ConnectionPanel, type ConnectionSummary } from './connection-panel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tài khoản nhận cọc · Sân Ngon' };

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/chu-san/thanh-toan');
  const { data: profile } = await db.from('profiles').select('role, owner_application_status').eq('id', user.id).single();
  if (!profile || !['owner', 'admin'].includes(profile.role) || profile.owner_application_status !== 'active') redirect('/dang-ky-san');
  const { data, error } = await db.rpc('get_my_sepay_connection');
  if (error) throw new Error('Chưa tải được tài khoản nhận cọc.');
  const params = await searchParams;
  return <main className="mx-auto max-w-4xl px-5 py-8 lg:px-10 lg:py-10">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Thanh toán</p>
    <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-pitch">Tài khoản nhận cọc</h1>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-secondary">Kết nối SePay để tiền cọc về tài khoản của bạn và đơn đặt sân tự được xác nhận. Một tài khoản nhận cọc cho tất cả cụm sân.</p>
    <ConnectionPanel connection={data as ConnectionSummary | null} callbackError={params.error} justConnected={params.connected === '1'} />
  </main>;
}
