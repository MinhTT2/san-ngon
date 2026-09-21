'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminVenueAction({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(status: 'active' | 'rejected') {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/venues/${venueId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) setError(result.error ?? 'Không lưu được. Hãy thử lại.');
      else router.refresh();
    } catch {
      setError('Không kết nối được. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  return <span className="inline-flex flex-col items-end gap-2"><span className="flex gap-2"><button type="button" onClick={() => review('active')} disabled={busy} className="rounded-control bg-pitch px-3 py-2 text-xs font-semibold text-pitch-ink disabled:opacity-60">{busy ? 'Đang lưu…' : 'Duyệt hồ sơ'}</button><button type="button" onClick={() => review('rejected')} disabled={busy} className="rounded-control border border-hairline px-3 py-2 text-xs font-semibold text-danger disabled:opacity-60">Từ chối</button></span>{error && <span role="alert" className="max-w-xs text-xs text-danger">{error}</span>}</span>;
}
