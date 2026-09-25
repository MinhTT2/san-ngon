'use client';

import { useState } from 'react';
import { vnd } from '@/lib/format';
import { OWNER_INPUT, OWNER_PRIMARY, OWNER_SECONDARY } from '@/components/owner-form-field';

type Rule = { id: string; label: string | null; days: number[]; start_time: string; end_time: string; price_per_hour: number; priority: number };
type Draft = Omit<Rule, 'id'> & { id: string | null };
const DAYS = [{ value: 1, label: 'Thứ 2' }, { value: 2, label: 'Thứ 3' }, { value: 3, label: 'Thứ 4' }, { value: 4, label: 'Thứ 5' }, { value: 5, label: 'Thứ 6' }, { value: 6, label: 'Thứ 7' }, { value: 0, label: 'Chủ nhật' }];

export function PriceEditor({ courtId, initialRules }: { courtId: string; initialRules: Rule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const base = draft?.label === 'Giá chung' && !!draft.id;

  function edit(rule?: Rule) {
    setError(''); setMessage('');
    setDraft(rule ? { ...rule, start_time: rule.start_time.slice(0, 5), end_time: rule.end_time.slice(0, 5) } : {
      id: null, label: '', days: [1, 2, 3, 4, 5, 6, 0], start_time: '16:00', end_time: '21:00', price_per_hour: 250000, priority: 10,
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    setError(''); setMessage('');
    if (!draft.days.length) { setError('Chọn ít nhất một ngày áp dụng.'); return; }
    if (draft.end_time <= draft.start_time) { setError('Giờ kết thúc phải sau giờ bắt đầu.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/courts/${courtId}/prices`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Không lưu được bảng giá.');
      const saved = result.rule as Rule;
      setRules(current => draft.id ? current.map(rule => rule.id === saved.id ? saved : rule) : [...current, saved]);
      setDraft(null); setMessage('Đã lưu mức giá. Giá mới áp dụng cho các đơn tạo sau khi lưu.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không kết nối được. Vui lòng thử lại.');
    } finally { setBusy(false); }
  }

  async function remove(rule: Rule) {
    if (busy || !window.confirm(`Xóa mức giá “${rule.label}”? Các khung giờ liên quan sẽ dùng mức giá còn lại phù hợp. Đơn đã tạo giữ nguyên giá.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/courts/${courtId}/prices`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: rule.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Không xóa được mức giá.');
      setRules(current => current.filter(item => item.id !== rule.id));
      if (draft?.id === rule.id) setDraft(null);
      setMessage('Đã xóa mức giá. Các đơn đã tạo giữ nguyên số tiền.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không kết nối được. Vui lòng thử lại.');
    } finally { setBusy(false); }
  }

  return <section className="mt-8 space-y-5 rounded-card border border-hairline bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl font-bold text-pitch">Các mức giá</h2><button type="button" disabled={busy} onClick={() => edit()} className={OWNER_PRIMARY}>Thêm mức giá</button></div>
    <p className="text-sm leading-6 text-ink-secondary">Giữ Giá chung làm mức mặc định. Thêm mức riêng cho giờ vàng hoặc cuối tuần, chọn ngày và khoảng giờ áp dụng.</p>
    {message && <p role="status" className="rounded-control bg-free-fill p-3 text-sm text-free-ink">{message}</p>}
    {error && <p role="alert" className="rounded-control border border-danger p-3 text-sm text-danger">{error}</p>}
    {draft && <form onSubmit={save} className="rounded-card border border-strong bg-page p-4">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-4 font-semibold text-pitch">{draft.id ? 'Sửa mức giá' : 'Mức giá mới'}</legend>
        <label className="space-y-2 text-sm font-semibold">Tên mức giá<input required maxLength={80} disabled={base} className={OWNER_INPUT} value={draft.label ?? ''} onChange={event => setDraft({ ...draft, label: event.target.value })} placeholder="VD: Cuối tuần buổi tối" /></label>
        <label className="space-y-2 text-sm font-semibold">Giá mỗi giờ (đ)<input type="number" required min={1000} max={10000000} step={1} className={OWNER_INPUT} value={draft.price_per_hour || ''} onChange={event => setDraft({ ...draft, price_per_hour: Number(event.target.value) })} /></label>
        {!base && <>
          <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-semibold">Ngày áp dụng</legend><div className="flex flex-wrap gap-2">{DAYS.map(day => <label key={day.value} className="flex min-h-11 items-center gap-2 rounded-control border border-hairline bg-card px-3 text-sm"><input type="checkbox" checked={draft.days.includes(day.value)} onChange={event => setDraft({ ...draft, days: event.target.checked ? [...draft.days, day.value] : draft.days.filter(value => value !== day.value) })} />{day.label}</label>)}</div></fieldset>
          <label className="space-y-2 text-sm font-semibold">Từ giờ<input type="time" required className={OWNER_INPUT} value={draft.start_time} onChange={event => setDraft({ ...draft, start_time: event.target.value })} /></label>
          <label className="space-y-2 text-sm font-semibold">Đến giờ<input type="time" required className={OWNER_INPUT} value={draft.end_time} onChange={event => setDraft({ ...draft, end_time: event.target.value })} /></label>
          <label className="space-y-2 text-sm font-semibold">Độ ưu tiên<input type="number" min={0} max={100} required className={OWNER_INPUT} value={draft.priority} onChange={event => setDraft({ ...draft, priority: Number(event.target.value) })} /></label>
          <p className="self-end text-xs leading-6 text-ink-secondary">Số lớn hơn được áp dụng trước khi trùng ngày/giờ. Cùng độ ưu tiên thì áp dụng giá cao hơn.</p>
        </>}
        {base && <p className="text-sm leading-6 text-ink-secondary sm:col-span-2">Giá chung luôn bao phủ giờ hoạt động của sân, không thể xóa hoặc đổi ngày/giờ tại đây.</p>}
        <div className="flex gap-3 sm:col-span-2"><button className={OWNER_PRIMARY}>{busy ? 'Đang lưu…' : 'Lưu mức giá'}</button><button type="button" className={OWNER_SECONDARY} onClick={() => setDraft(null)}>Hủy chỉnh sửa</button></div>
      </fieldset>
    </form>}
    <ul className="divide-y divide-hairline border-y border-hairline">{[...rules].sort((a, b) => b.priority - a.priority || b.price_per_hour - a.price_per_hour).map(rule => <li key={rule.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
      <div className="min-w-0"><h3 className="font-semibold text-pitch">{rule.label ?? 'Mức giá'}</h3><p className="mt-1 text-sm text-ink-secondary">{DAYS.filter(day => rule.days.includes(day.value)).map(day => day.label).join(', ')} · {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}</p><p className="mt-1 text-sm"><strong>{vnd(rule.price_per_hour)}/giờ</strong><span className="ml-3 text-xs text-ink-secondary">Ưu tiên {rule.priority}</span></p></div>
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => edit(rule)} aria-label={`Sửa ${rule.label}`} className={OWNER_SECONDARY}>Sửa</button>{rule.label !== 'Giá chung' && <button type="button" disabled={busy} onClick={() => remove(rule)} aria-label={`Xóa ${rule.label}`} className={`${OWNER_SECONDARY} text-danger`}>Xóa</button>}</div>
    </li>)}</ul>
  </section>;
}
