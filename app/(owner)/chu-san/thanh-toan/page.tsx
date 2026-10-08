import { DashboardPageHeader } from '@/components/dashboard-page-header';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ConnectionPanel, type ConnectionSummary } from '@/components/sepay-connection-panel';

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
  return <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <DashboardPageHeader eyebrow="Chủ sân / Thanh toán" title="Tài khoản nhận cọc" description="Kết nối SePay để nhận cọc và tự xác nhận đơn. Một tài khoản nhận tiền cho tất cả cụm sân." />
    <ConnectionPanel connection={data as ConnectionSummary | null} callbackError={params.error} justConnected={params.connected === '1'} />
  </main>;
}
