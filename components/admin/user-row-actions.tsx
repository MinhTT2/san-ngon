'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BanDialog } from './ban-dialog';
import { EditUserDialog } from './edit-user-dialog';
import type { AdminUserRow } from '@/lib/types';

export function UserRowActions({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<'edit' | 'ban' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, method: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(json.error ?? 'Thao tác không thành công.'); return; }
    setConfirmDelete(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        <Action onClick={() => setDialog('edit')} disabled={busy}>Sửa</Action>

        {user.banned_at ? (
          <Action onClick={() => call(`/api/admin/users/${user.id}/ban`, 'DELETE')} disabled={busy} tone="pitch">
            Mở khoá
          </Action>
        ) : (
          <Action onClick={() => setDialog('ban')} disabled={busy || isSelf}
            title={isSelf ? 'Không tự khoá tài khoản của mình được' : undefined} tone="danger">
            Khoá
          </Action>
        )}

        {confirmDelete ? (
          <span className="flex items-center gap-1">
            <Action onClick={() => call(`/api/admin/users/${user.id}`, 'DELETE')} disabled={busy} tone="danger">
              {busy ? 'Đang xoá…' : 'Xoá thật'}
            </Action>
            <Action onClick={() => setConfirmDelete(false)} disabled={busy}>Thôi</Action>
          </span>
        ) : (
          <Action onClick={() => setConfirmDelete(true)} disabled={busy || isSelf}
            title={isSelf ? 'Không tự xoá tài khoản của mình được' : undefined}>
            Xoá
          </Action>
        )}
      </div>

      {error && <span className="max-w-64 text-right text-xs leading-snug text-danger">{error}</span>}

      {dialog === 'edit' && <EditUserDialog user={user} open onClose={() => setDialog(null)} />}
      {dialog === 'ban' && <BanDialog user={user} open onClose={() => setDialog(null)} />}
    </div>
  );
}

function Action({
  onClick, disabled, tone, title, children,
}: {
  onClick: () => void; disabled?: boolean; tone?: 'danger' | 'pitch'; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-control px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-sunk disabled:opacity-40 disabled:hover:bg-transparent ${
        tone === 'danger' ? 'text-danger' : tone === 'pitch' ? 'text-pitch' : 'text-ink-secondary'
      }`}
    >
      {children}
    </button>
  );
}
