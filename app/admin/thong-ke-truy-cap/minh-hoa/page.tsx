import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TrafficDemoReport } from '@/components/traffic-demo-report';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Báo cáo minh họa · Sân Ngon' };

export default async function Page() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/thong-ke-truy-cap/minh-hoa');
  const { data: admin, error } = await db.rpc('is_admin');
  if (error) throw new Error('Chưa kiểm tra được quyền quản trị.');
  if (!admin) redirect('/');
  return <TrafficDemoReport />;
}
