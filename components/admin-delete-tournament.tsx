'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminDeleteTournament({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (!window.confirm(`Xóa vĩnh viễn giải “${title}”? Lịch sân sẽ được mở lại. Chỉ xóa được giải chưa có đăng ký và nghĩa vụ tiền thuê/quyết toán.`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/tournaments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Chưa xóa được giải.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa xóa được giải. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="border-t border-hairline px-5 py-3">
    <button type="button" disabled={busy} onClick={remove} className="min-h-11 rounded-control border border-hairline px-4 text-sm font-semibold text-ink-secondary disabled:opacity-50">{busy ? 'Đang xóa…' : 'Xóa giải'}</button>
    {error && <p role="alert" className="mt-2 text-sm text-ink-secondary">{error}</p>}
  </div>;
}
