'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './modal';
import { ROLE_LABELS } from '@/lib/constants';
import type { AdminUserRow } from '@/lib/types';

export function EditUserDialog({
  user,
  open,
  onClose,
}: {
  user: AdminUserRow;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.full_name ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [role, setRole] = useState(user.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, phone, role }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? 'Không lưu được.'); return; }
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="Sửa tài khoản" description={user.email}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Họ tên" htmlFor="ed-name">
          <input id="ed-name" value={fullName} onChange={(e) => setFullName(e.target.value)}
            maxLength={100} className={INPUT} />
        </Field>

        <Field label="Số điện thoại" htmlFor="ed-phone">
          <input id="ed-phone" type="tel" inputMode="numeric" pattern="0\d{9}"
            value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0987654321"
            className={INPUT} />
        </Field>

        <Field
          label="Vai trò"
          htmlFor="ed-role"
          hint={role === 'admin' ? 'Quản trị thấy và sửa được mọi tài khoản. Cấp quyền này cẩn thận.' : undefined}
        >
          <select id="ed-role" value={role}
            onChange={(e) => setRole(e.target.value as AdminUserRow['role'])} className={INPUT}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>

        {error && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/5 p-3 text-sm leading-relaxed text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy}
            className="h-11 rounded-control border border-hairline px-5 text-sm font-semibold">
            Thôi
          </button>
          <button type="submit" disabled={busy}
            className="h-11 rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink disabled:opacity-60">
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const INPUT = 'h-12 w-full rounded-control border border-hairline bg-page px-3.5 text-[15px] focus:border-pitch focus:outline-none';

function Field({ label, htmlFor, hint, children }: {
  label: string; htmlFor: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && <span className="text-xs leading-relaxed text-ink-secondary">{hint}</span>}
    </div>
  );
}
