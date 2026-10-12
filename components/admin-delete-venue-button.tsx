'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminDeleteVenueButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy || !window.confirm(`Xóa cụm sân “${name}” và tất cả sân con? Thao tác này không thể hoàn tác. Chỉ xóa cụm sân chưa có đơn đặt và không còn giải đấu liên quan.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/venues/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? 'Không xóa được sân. Hãy thử lại.');
      } else router.refresh();
    } catch {
      setError('Không kết nối được. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex min-w-0 flex-col items-start gap-2">
    <button type="button" disabled={busy} onClick={remove} aria-label={`Xóa sân: ${name}`} className="pf-action min-h-11 rounded-control border border-danger/30 px-3 text-xs font-semibold text-danger hover:bg-danger/5 disabled:opacity-60">{busy ? 'Đang xóa…' : 'Xóa sân'}</button>
    {error && <p role="alert" className="max-w-sm text-xs leading-6 text-danger">{error}</p>}
  </div>;
}
