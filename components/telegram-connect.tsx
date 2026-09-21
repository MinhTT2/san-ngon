'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TelegramConnect({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(connected);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
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

  async function checkConnection() {
    setChecking(true);
    setError(null);
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const res = await fetch('/api/telegram/connect', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Không kiểm tra được trạng thái kết nối.');
        if (data.connected) {
          setIsConnected(true);
          setUrl(null);
          router.refresh();
          return;
        }
        if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 750));
      }
      setError('Chưa nhận được tín hiệu từ Telegram. Hãy bấm Start trong đúng link vừa mở rồi thử lại.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không kiểm tra được trạng thái kết nối.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="mt-8 rounded-card border border-hairline bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-pitch">Telegram báo đơn</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-secondary">
            {isConnected
              ? 'Đã kết nối. Khi khách chuyển khoản thành công, thông tin đơn sẽ được gửi vào Telegram của bạn.'
              : 'Kết nối một lần để nhận thông báo đơn mới, không cần nhập chat_id bằng tay.'}
          </p>
        </div>
        <span className={`rounded-pill px-3 py-1 text-xs font-medium ${isConnected ? 'bg-free-fill text-free-ink' : 'bg-peak-fill text-peak-ink'}`}>
          {isConnected ? 'Đã kết nối' : 'Chưa kết nối'}
        </span>
      </div>

      <button
        type="button"
        onClick={createLink}
        disabled={busy}
        className="mt-5 min-h-11 rounded-control bg-pitch px-4 text-sm font-semibold text-pitch-ink disabled:opacity-60"
      >
        {busy ? 'Đang tạo link…' : isConnected ? 'Kết nối lại Telegram' : 'Tạo link kết nối'}
      </button>

      {url && (
        <div className="mt-4 border-l-2 border-free-line bg-free-fill px-4 py-3 text-sm leading-6 text-free-ink">
          <p>Link có hiệu lực trong ít phút và chỉ dùng một lần.</p>
          <div className="mt-2 flex flex-wrap gap-4 font-semibold">
            <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">Mở Telegram</a>
            <button type="button" onClick={checkConnection} disabled={checking} className="underline underline-offset-4 disabled:opacity-60">
              {checking ? 'Đang kiểm tra…' : 'Tôi đã bấm Start'}
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    </section>
  );
}
