'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminVenueAction({ venueId }: { venueId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function approve() {
    setBusy(true);
    setError(false);
    const response = await fetch(`/api/admin/venues/${venueId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    if (!response.ok) setError(true);
    else router.refresh();
    setBusy(false);
  }

  return <span className="inline-flex flex-col items-end gap-1"><button type="button" onClick={approve} disabled={busy} className="rounded-control bg-pitch px-3 py-2 text-xs font-semibold text-pitch-ink">{busy ? 'Đang lưu…' : 'Duyệt hồ sơ'}</button>{error && <span className="text-[11px] text-danger">Thử lại</span>}</span>;
}
