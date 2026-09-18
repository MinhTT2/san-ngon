'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TelegramConnect({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createLink() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/connect', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Không tạo được link kết nối.');
        return;
      }
      setUrl(data.url);
    } catch {
      setError('Không kết nối được. Thử lại sau.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-card border border-hairline bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-pitch">Telegram báo đơn</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-secondary">
            {connected
              ? 'Đã kết nối. Khi khách chuyển khoản thành công, thông tin đơn sẽ được gửi vào Telegram của bạn.'
              : 'Kết nối một lần để nhận thông báo đơn mới, không cần nhập chat_id bằng tay.'}
          </p>
        </div>
        <span className={`rounded-pill px-3 py-1 text-xs font-medium ${connected ? 'bg-free-fill text-free-ink' : 'bg-peak-fill text-peak-ink'}`}>
          {connected ? 'Đã kết nối' : 'Chưa kết nối'}
        </span>
      </div>

      <button
        type="button"
        onClick={createLink}
        disabled={busy}
        className="mt-5 min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink disabled:opacity-60"
      >
        {busy ? 'Đang tạo link…' : connected ? 'Kết nối lại Telegram' : 'Tạo link kết nối'}
      </button>

      {url && (
        <div className="mt-4 border-l-2 border-free-line bg-free-fill px-4 py-3 text-sm leading-6 text-free-ink">
          <p>Link có hiệu lực trong 10 phút và chỉ dùng một lần.</p>
          <div className="mt-2 flex flex-wrap gap-4 font-semibold">
            <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">Mở Telegram</a>
            <button type="button" onClick={() => router.refresh()} className="underline underline-offset-4">Tôi đã bấm Start</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </section>
  );
}
