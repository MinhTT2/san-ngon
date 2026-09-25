import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserList } from '@/lib/admin-users';
import { UserManagement } from './user-management';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quản lý người dùng · Sân Ngon' };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; role?: string; page?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/admin/users');
  const { data: admin } = await supabase.rpc('is_admin');
  if (!admin) redirect('/');
  const params = await searchParams;
  const filters = { q: (params.q ?? '').slice(0, 100), status: ['active', 'banned'].includes(params.status ?? '') ? params.status! : 'all', role: ['player', 'owner', 'admin'].includes(params.role ?? '') ? params.role! : 'all', page: Math.max(1, Math.min(100000, Number.parseInt(params.page ?? '1') || 1)) };
  const { data, error } = await supabase.rpc('admin_list_users', { p_search: filters.q, p_status: filters.status, p_role: filters.role, p_page: filters.page });
  if (error) throw new Error('Không tải được danh sách người dùng. Vui lòng thử lại.');
  return <UserManagement data={data as UserList} currentId={user.id} filters={filters} />;
}
