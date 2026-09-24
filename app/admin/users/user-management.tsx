'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react';
import type { AdminUser, UserList } from '@/lib/admin-users';
import { ROLE_LABELS } from '@/lib/admin-users';
import { Modal } from '@/components/modal';

const INPUT = 'h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm outline-none focus:border-pitch focus:ring-2 focus:ring-strong';
const roleTone: Record<AdminUser['role'], string> = { player: 'bg-sunk text-ink-secondary', owner: 'bg-free-fill text-free-ink', admin: 'bg-pitch text-pitch-ink' };

export function UserManagement({ data: initial, currentId, filters }: { data: UserList; currentId: string; filters: { q: string; status: string; role: string; page: number } }) {
  const router = useRouter();
  const data = initial;
  const [query, setQuery] = useState(filters.q);
  const [editing, setEditing] = useState<string | null>(null);
  const [banning, setBanning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => data.users, [data.users]);
  function applyFilters(next: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = { q: filters.q, status: filters.status, role: filters.role, page: String(filters.page), ...next };
    Object.entries(merged).forEach(([key, value]) => { if (value && value !== 'all' && value !== '1') params.set(key, value); });
    router.push(`/admin/users${params.toString() ? `?${params}` : ''}`);
  }
  async function save(id: string, body: unknown, method = 'PATCH') {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${id}`, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Không lưu được.');
      setNotice({ text: method === 'DELETE' ? 'Đã xóa tài khoản.' : 'Đã lưu thay đổi.' });
      setEditing(null); setBanning(null); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : 'Không kết nối được. Vui lòng thử lại.', error: true }); }
    finally { setBusy(false); }
  }
  async function create(body: unknown) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? 'Không tạo được tài khoản.');
      setCreateOpen(false); setNotice({ text: 'Đã tạo tài khoản.' }); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : 'Không kết nối được. Vui lòng thử lại.', error: true }); }
    finally { setBusy(false); }
  }
  return (
    <main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-ink-secondary">Quản trị hệ thống</p><h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-pitch">Người dùng</h1><p className="mt-2 max-w-xl text-sm leading-6 text-ink-secondary">Quản lý vai trò và quyền truy cập. Mọi lần khóa đều lưu lý do để dễ đối soát.</p></div>
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink"><Plus className="size-4" />Tạo tài khoản</button>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3"><Stat icon={UserRound} value={data.total} label="Tổng tài khoản" /><Stat icon={Check} value={data.active} label="Đang hoạt động" tone="green" /><Stat icon={Ban} value={data.banned} label="Đang bị khóa" tone="amber" /></div>
      {notice && <p role={notice.error ? 'alert' : 'status'} className={`mt-6 rounded-card border px-4 py-3 text-sm ${notice.error ? 'border-danger bg-[#FFF5F5] text-danger' : 'border-free-line bg-free-fill text-free-ink'}`}>{notice.text}</p>}
      {createOpen && <Modal title="Tạo tài khoản" subtitle="Tài khoản được xác nhận email sẵn để dùng ngay." onClose={() => setCreateOpen(false)}><CreateForm busy={busy} onCancel={() => setCreateOpen(false)} onCreate={create} /></Modal>}
      <section className="mt-6 overflow-hidden rounded-card border border-hairline bg-card">
        <div className="flex flex-wrap gap-3 border-b border-hairline p-4 lg:p-5"><label className="relative min-w-[240px] flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-ink-secondary" /><input aria-label="Tìm người dùng" className={`${INPUT} pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyFilters({ q: query, page: '1' }); }} placeholder="Tìm theo tên, email, số điện thoại…" /></label><select aria-label="Lọc vai trò" className={`${INPUT} w-auto min-w-36`} value={filters.role} onChange={(e) => applyFilters({ role: e.target.value, page: '1' })}><option value="all">Tất cả vai trò</option><option value="player">Người chơi</option><option value="owner">Chủ sân</option><option value="admin">Quản trị viên</option></select><select aria-label="Lọc trạng thái" className={`${INPUT} w-auto min-w-36`} value={filters.status} onChange={(e) => applyFilters({ status: e.target.value, page: '1' })}><option value="all">Tất cả trạng thái</option><option value="active">Đang hoạt động</option><option value="banned">Đang bị khóa</option></select></div>
        {rows.length === 0 ? <p className="p-12 text-center text-sm text-ink-secondary">Không tìm thấy tài khoản phù hợp.</p> : <div className="divide-y divide-hairline">{rows.map((item) => <UserRow key={item.id} user={item} currentId={currentId} editing={editing === item.id} banning={banning === item.id} busy={busy} onEdit={() => { setEditing(item.id); setBanning(null); }} onBan={() => { setBanning(item.id); setEditing(null); }} onCancel={() => { setEditing(null); setBanning(null); }} onSave={(body) => save(item.id, body)} onAction={(body) => save(item.id, body, 'POST')} onDelete={() => save(item.id, undefined, 'DELETE')} />)}</div>}
        <div className="flex items-center justify-between border-t border-hairline px-4 py-3 text-sm text-ink-secondary"><span>{data.total} tài khoản</span><div className="flex gap-2"><button type="button" disabled={filters.page <= 1} onClick={() => applyFilters({ page: String(filters.page - 1) })} className="rounded-control border border-hairline p-2 disabled:opacity-40" aria-label="Trang trước"><ChevronLeft className="size-4" /></button><span className="flex min-w-9 items-center justify-center">{filters.page}</span><button type="button" disabled={rows.length < 20} onClick={() => applyFilters({ page: String(filters.page + 1) })} className="rounded-control border border-hairline p-2 disabled:opacity-40" aria-label="Trang sau"><ChevronRight className="size-4" /></button></div></div>
      </section>
    </main>
  );
}

function UserRow({ user, currentId, editing, banning, busy, onEdit, onBan, onCancel, onSave, onAction, onDelete }: { user: AdminUser; currentId: string; editing: boolean; banning: boolean; busy: boolean; onEdit: () => void; onBan: () => void; onCancel: () => void; onSave: (body: unknown) => void; onAction: (body: unknown) => void; onDelete: () => void }) {
  return <article className="p-4 lg:px-5"><div className="flex flex-wrap items-center gap-4"><span className="flex size-10 flex-none items-center justify-center rounded-full bg-pitch font-display font-bold text-pitch-ink">{(user.full_name ?? user.email ?? '?').slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-pitch">{user.full_name || 'Chưa cập nhật tên'} {user.id === currentId && <span className="ml-1 text-xs font-normal text-ink-secondary">(bạn)</span>}</p><p className="mt-1 truncate text-sm text-ink-secondary">{user.email ?? 'Không có email'} · {user.phone ?? 'Chưa có số điện thoại'}</p></div><span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${roleTone[user.role]}`}>{ROLE_LABELS[user.role]}</span><span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${user.is_banned ? 'bg-[#FFF5F5] text-danger' : 'bg-free-fill text-free-ink'}`}>{user.is_banned ? 'Đang khóa' : 'Hoạt động'}</span><div className="flex gap-2"><button type="button" onClick={onEdit} disabled={busy} className="inline-flex items-center gap-1.5 rounded-control border border-hairline px-3 py-2 text-xs font-semibold text-pitch disabled:opacity-50"><Pencil className="size-3.5" />Sửa</button>{user.id !== currentId && <button type="button" onClick={user.is_banned ? () => onAction({ action: 'unban' }) : onBan} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-control border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${user.is_banned ? 'border-free-line text-free-ink' : 'border-danger/30 text-danger'}`}><Ban className="size-3.5" />{user.is_banned ? 'Mở khóa' : 'Khóa'}</button>}</div></div>{user.is_banned && <p className="mt-3 border-l-2 border-danger/30 pl-3 text-xs leading-5 text-ink-secondary">Lý do: {user.ban_reason ?? 'Không ghi lý do'} · {user.banned_until === 'infinity' ? 'Vô thời hạn' : user.banned_until ? `đến ${new Date(user.banned_until).toLocaleDateString('vi-VN')}` : 'đã khóa'}</p>}{editing && <Modal title="Sửa tài khoản" subtitle={user.full_name || user.email || undefined} onClose={onCancel}><EditForm user={user} busy={busy} onCancel={onCancel} onSave={onSave} /></Modal>}{banning && <Modal title="Khóa tài khoản" subtitle={user.full_name || user.email || undefined} onClose={onCancel}><BanForm busy={busy} onCancel={onCancel} onBan={(body) => onAction(body)} /></Modal>}{editing === false && banning === false && user.id !== currentId && user.is_banned && <button type="button" onClick={onDelete} disabled={busy} className="mt-3 inline-flex items-center gap-1 text-xs text-danger underline underline-offset-2 disabled:opacity-50"><Trash2 className="size-3.5" />Xóa vĩnh viễn</button>}</article>;
}

function EditForm({ user, busy, onCancel, onSave }: { user: AdminUser; busy: boolean; onCancel: () => void; onSave: (body: unknown) => void }) { const [name, setName] = useState(user.full_name ?? ''); const [phone, setPhone] = useState(user.phone ?? ''); const [role, setRole] = useState(user.role); return <form className="grid gap-3 sm:grid-cols-[1fr_180px_160px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); onSave({ full_name: name, phone, role }); }}><label className="text-sm font-semibold">Họ tên<input className={`${INPUT} mt-1.5`} required value={name} onChange={(e) => setName(e.target.value)} /></label><label className="text-sm font-semibold">Số điện thoại<input className={`${INPUT} mt-1.5`} value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label className="text-sm font-semibold">Vai trò<select className={`${INPUT} mt-1.5`} value={role} onChange={(e) => setRole(e.target.value as AdminUser['role'])}><option value="player">Người chơi</option><option value="owner">Chủ sân</option><option value="admin">Quản trị viên</option></select></label><div className="flex gap-2"><button disabled={busy} className="rounded-control bg-pitch px-3 py-2.5 text-xs font-semibold text-pitch-ink">Lưu</button><button type="button" onClick={onCancel} className="rounded-control border border-hairline px-3 py-2.5 text-xs font-semibold">Hủy</button></div></form>; }

function BanForm({ busy, onCancel, onBan }: { busy: boolean; onCancel: () => void; onBan: (body: unknown) => void }) { const [reason, setReason] = useState(''); const [days, setDays] = useState(7); return <form className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); onBan({ action: 'ban', reason, days }); }}><label className="text-sm font-semibold">Thời hạn<select className={`${INPUT} mt-1.5`} value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>1 ngày</option><option value={7}>7 ngày</option><option value={30}>30 ngày</option><option value={0}>Vô thời hạn</option></select></label><label className="text-sm font-semibold">Lý do khóa<input className={`${INPUT} mt-1.5`} required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: spam hoặc vi phạm quy định sân" /></label><div className="flex gap-2"><button disabled={busy} className="rounded-control bg-danger px-3 py-2.5 text-xs font-semibold text-white">{busy ? 'Đang lưu…' : 'Xác nhận khóa'}</button><button type="button" onClick={onCancel} className="rounded-control border border-hairline px-3 py-2.5 text-xs font-semibold">Hủy</button></div></form>; }

function CreateForm({ busy, onCancel, onCreate }: { busy: boolean; onCancel: () => void; onCreate: (body: unknown) => void }) { const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState<AdminUser['role']>('player'); return <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); onCreate({ full_name: name, email, phone, password, role }); }}><label className="text-sm font-semibold">Họ tên<input className={`${INPUT} mt-1.5`} required value={name} onChange={(e) => setName(e.target.value)} /></label><label className="text-sm font-semibold">Email<input className={`${INPUT} mt-1.5`} required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="text-sm font-semibold">Số điện thoại<input className={`${INPUT} mt-1.5`} value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label className="text-sm font-semibold">Vai trò<select className={`${INPUT} mt-1.5`} value={role} onChange={(e) => setRole(e.target.value as AdminUser['role'])}><option value="player">Người chơi</option><option value="owner">Chủ sân</option><option value="admin">Quản trị viên</option></select></label><label className="text-sm font-semibold sm:col-span-2">Mật khẩu tạm<input className={`${INPUT} mt-1.5`} required minLength={12} type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><div className="flex items-end gap-2"><button disabled={busy} className="rounded-control bg-pitch px-4 py-2.5 text-sm font-semibold text-pitch-ink">{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</button><button type="button" onClick={onCancel} className="rounded-control border border-hairline px-4 py-2.5 text-sm font-semibold">Hủy</button></div></form>; }

function Stat({ icon: Icon, value, label, tone }: { icon: typeof UserRound; value: number; label: string; tone?: 'green' | 'amber' }) { return <div className="flex items-center gap-4 rounded-card border border-hairline bg-card p-5"><span className={`flex size-11 items-center justify-center rounded-control ${tone === 'amber' ? 'bg-peak-fill text-peak-ink' : tone === 'green' ? 'bg-free-fill text-free-ink' : 'bg-pitch text-pitch-ink'}`}><Icon className="size-5" /></span><span><strong className="block font-display text-2xl font-bold text-pitch">{value}</strong><span className="text-xs text-ink-secondary">{label}</span></span></div>; }
