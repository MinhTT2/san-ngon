'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hhmm, dayLabel } from '@/lib/format';

export type ConnectionSummary = {
  status: 'setup' | 'ready' | 'reconnect' | 'disconnected'; bank: string | null;
  account_number: string | null; account_name: string | null; bank_account_id: string | null;
  has_authorization: boolean; rollout_enabled: boolean; checked_at: string | null; last_webhook_at: string | null;
};
type Account = { id: string; account_number: string; account_holder_name: string; bank: { short_name: string } };
const STATUS = { setup: 'Chưa hoàn tất', ready: 'Đã kết nối', reconnect: 'Cần kết nối lại', disconnected: 'Đã ngắt kết nối' };
const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-control border border-hairline px-5 text-sm font-semibold text-pitch disabled:opacity-50';

export function ConnectionPanel({ connection: c, callbackError, justConnected }: {
  connection: ConnectionSummary | null; callbackError?: string; justConnected: boolean;
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState(c?.bank_account_id ?? '');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(callbackError ? callbackError === 'ACCESS_DENIED'
    ? 'Bạn đã từ chối cấp quyền. Có thể kết nối lại khi sẵn sàng.' : 'Chưa hoàn tất cấp quyền SePay. Vui lòng bấm kết nối lại.' : '');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  async function loadAccounts(signal?: AbortSignal) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/sepay/accounts', { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Không tải được tài khoản ngân hàng.');
      setAccounts(data.accounts); setLoaded(true);
    } catch (error) { if (!signal?.aborted) setError(error instanceof Error ? error.message : 'Không kết nối được.'); }
    finally { if (!signal?.aborted) setBusy(false); }
  }
  useEffect(() => {
    if (!c?.has_authorization || (c.status === 'ready' && !justConnected)) return;
    const controller = new AbortController();
    void loadAccounts(controller.signal);
    return () => controller.abort();
  }, [c?.has_authorization, c?.status, justConnected]);

  async function action(path: 'connect' | 'connection', method = 'POST', accountId?: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/sepay/${path}`, { method, headers: { 'Content-Type': 'application/json' },
        body: accountId ? JSON.stringify({ account_id: accountId }) : undefined });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Chưa hoàn tất. Vui lòng thử lại.');
      if (data.url) { window.location.assign(data.url); return; }
      setConfirmDisconnect(false); setLoaded(false); router.replace('/chu-san/thanh-toan'); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Không kết nối được.'); router.refresh(); }
    finally { setBusy(false); }
  }

  return <section className="mt-8 rounded-card border border-hairline bg-card p-5 sm:p-8" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl font-bold text-pitch">Nhận cọc qua SePay</h2><span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold text-pitch">{c ? STATUS[c.status] : 'Chưa kết nối'}</span></div>
    {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
    {c?.bank && <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">{[['Ngân hàng', c.bank], ['Số tài khoản', c.account_number], ['Người nhận', c.account_name]].map(([label, value]) => <div key={label}><dt className="text-ink-secondary">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>}
    {c?.status === 'ready' ? <>
      <p className="mt-6 text-sm leading-7 text-ink-secondary">{c.rollout_enabled ? 'Các đơn mới sẽ chuyển cọc vào tài khoản trên. Khi nhận đủ cọc đúng mã đơn, lịch sân và trạng thái đơn tự cập nhật.' : 'Kết nối đã sẵn sàng. Sân Ngon sẽ mở nhận đơn sau khi hoàn tất kiểm tra chuyển khoản thử.'}</p>
      <div className="mt-3 space-y-1 text-xs text-ink-secondary">{c.checked_at && <p>Kiểm tra gần nhất: {dayLabel(new Date(c.checked_at))} · {hhmm(c.checked_at)}</p>}{c.last_webhook_at ? <p>Nhận thông báo ngân hàng gần nhất: {dayLabel(new Date(c.last_webhook_at))} · {hhmm(c.last_webhook_at)}</p> : <p>Chưa nhận thông báo giao dịch từ ngân hàng.</p>}</div>
      <div className="mt-6 flex flex-wrap gap-3"><button className={BUTTON} disabled={busy} onClick={() => action('connection', 'POST', c.bank_account_id!)}>Kiểm tra kết nối</button><button className={BUTTON} disabled={busy} onClick={() => setConfirmDisconnect(true)}>Ngắt kết nối</button></div>
    </> : <>
      <ol className="mt-5 list-inside list-decimal space-y-2 text-sm leading-7 text-ink-secondary"><li>Đăng ký SePay và liên kết tài khoản ngân hàng của bạn.</li><li>Kết nối với Sân Ngon, sau đó chọn tài khoản nhận cọc.</li><li>Hoàn tất kết nối để bắt đầu nhận đơn tự động.</li></ol>
      <div className="mt-6 flex flex-wrap gap-3"><button className={`${BUTTON} bg-pitch text-pitch-ink`} disabled={busy} onClick={() => action('connect')}>{busy ? 'Đang xử lý…' : c?.has_authorization ? 'Kết nối lại SePay' : 'Kết nối SePay'}</button>{c?.status === 'disconnected' && c.has_authorization && <button className={BUTTON} disabled={busy} onClick={() => action('connection', 'DELETE')}>Thử lại ngắt kết nối</button>}<a href="https://my.sepay.vn" target="_blank" rel="noopener noreferrer" className={BUTTON}>Mở SePay</a>{c?.has_authorization && <button className={BUTTON} disabled={busy} onClick={() => loadAccounts()}>Tải lại tài khoản</button>}</div>
    </>}
    {loaded && c?.status !== 'ready' && <div className="mt-7 border-t border-hairline pt-6"><h3 className="font-semibold text-pitch">Chọn tài khoản nhận cọc</h3>
      {accounts.length ? <><fieldset className="mt-3 space-y-3"><legend className="sr-only">Tài khoản ngân hàng đã liên kết</legend>{accounts.map(a => <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-control border border-hairline p-4"><input className="mt-1 accent-pitch" type="radio" name="bank-account" value={a.id} checked={selected === a.id} disabled={busy || Boolean(c?.bank_account_id && c.bank_account_id !== a.id)} onChange={() => setSelected(a.id)} /><span className="text-sm"><strong>{a.bank.short_name} · {a.account_number}</strong><span className="mt-1 block text-ink-secondary">{a.account_holder_name}</span></span></label>)}</fieldset><button className={`${BUTTON} mt-5 bg-pitch text-pitch-ink`} disabled={busy || !selected} onClick={() => action('connection', 'POST', selected)}>{busy ? 'Đang thiết lập…' : 'Dùng tài khoản này'}</button></> : <p className="mt-3 text-sm leading-7 text-ink-secondary">Chưa có tài khoản ngân hàng đang hoạt động. Liên kết ngân hàng trên SePay, rồi bấm “Tải lại tài khoản”.</p>}
      {c?.bank_account_id && <p className="mt-3 text-xs text-ink-secondary">Hiện hỗ trợ kết nối lại cùng tài khoản đã chọn. Liên hệ hỗ trợ nếu cần đổi ngân hàng.</p>}
    </div>}
    {confirmDisconnect && <div className="mt-6 rounded-control border border-hairline bg-sunk p-4"><p className="text-sm leading-7">Ngắt kết nối sẽ dừng nhận đơn mới. Chỉ thực hiện khi không còn đơn đang chờ cọc.</p><div className="mt-3 flex flex-wrap gap-3"><button className={BUTTON} disabled={busy} onClick={() => setConfirmDisconnect(false)}>Quay lại</button><button className={`${BUTTON} bg-pitch text-pitch-ink`} disabled={busy} onClick={() => action('connection', 'DELETE')}>Xác nhận ngắt kết nối</button></div></div>}
  </section>;
}
