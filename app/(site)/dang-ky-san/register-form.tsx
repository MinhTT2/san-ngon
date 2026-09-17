'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DISTRICTS, SPORT_LABELS } from '@/lib/constants';
import { vnd } from '@/lib/format';

/**
 * Form đăng sân. Cố tình ngắn: mỗi ô thêm vào là một chủ sân bỏ dở giữa chừng.
 * Ảnh sân, tiện ích, tách bảng giá theo khung giờ đều để lại sau khi duyệt.
 */
export function RegisterForm({ defaultPhone }: { defaultPhone?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState(250_000);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get('name') ?? ''),
      address: String(f.get('address') ?? ''),
      district: String(f.get('district') ?? ''),
      phone: String(f.get('phone') ?? ''),
      description: String(f.get('description') ?? '') || undefined,
      open_time: String(f.get('open_time') ?? ''),
      close_time: String(f.get('close_time') ?? ''),
      sport: String(f.get('sport') ?? ''),
      court_count: Number(f.get('court_count') ?? 0),
      price_per_hour: Number(f.get('price_per_hour') ?? 0),
      payout_bank: String(f.get('payout_bank') ?? '') || undefined,
      payout_account: String(f.get('payout_account') ?? '') || undefined,
    };

    const res = await fetch('/api/venues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      router.push('/dang-nhap?next=/dang-ky-san');
      return;
    }

    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setError(json.error ?? 'Không gửi được hồ sơ.'); return; }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-7">
      <Fieldset legend="Cụm sân">
        <Field label="Tên cụm sân" htmlFor="name">
          <input id="name" name="name" required minLength={3} maxLength={120}
            placeholder="Sân bóng Mỹ Đình" className={INPUT} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label="Địa chỉ" htmlFor="address">
            <input id="address" name="address" required minLength={3} maxLength={200}
              placeholder="Ngõ 5 Lê Đức Thọ" className={INPUT} />
          </Field>
          <Field label="Quận/huyện" htmlFor="district">
            <select id="district" name="district" required defaultValue="" className={INPUT}>
              <option value="" disabled>Chọn quận</option>
              {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Số điện thoại" htmlFor="phone" hint="Khách gọi số này khi tới sân.">
          <input id="phone" name="phone" type="tel" required inputMode="numeric" pattern="0\d{9}"
            defaultValue={defaultPhone ?? ''} placeholder="0987654321" className={INPUT} />
        </Field>

        <Field label="Mô tả" htmlFor="description" optional>
          <textarea id="description" name="description" rows={2} maxLength={500}
            placeholder="Cỏ nhân tạo, đèn cao áp, có mái che một phần."
            className={`${INPUT} h-auto resize-none py-3`} />
        </Field>
      </Fieldset>

      <Fieldset legend="Sân con và giờ mở cửa">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Môn" htmlFor="sport">
            <select id="sport" name="sport" required defaultValue="football5" className={INPUT}>
              {Object.entries(SPORT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Số sân con" htmlFor="court_count" hint="Đặt thêm môn khác sau khi duyệt.">
            <input id="court_count" name="court_count" type="number" required min={1} max={20}
              defaultValue={4} className={INPUT} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mở cửa" htmlFor="open_time">
            <input id="open_time" name="open_time" type="time" required defaultValue="05:00" className={INPUT} />
          </Field>
          <Field label="Đóng cửa" htmlFor="close_time">
            <input id="close_time" name="close_time" type="time" required defaultValue="23:00" className={INPUT} />
          </Field>
        </div>

        <Field
          label="Giá thuê một giờ"
          htmlFor="price_per_hour"
          hint={`Một mức chung cho cả tuần: ${vnd(price || 0)}/giờ. Tách giờ vàng, giờ đêm, cuối tuần sau khi duyệt.`}
        >
          <input id="price_per_hour" name="price_per_hour" type="number" required
            min={1000} max={10_000_000} step={10_000} value={price}
            onChange={(e) => setPrice(Number(e.target.value))} className={INPUT} />
        </Field>
      </Fieldset>

      <Fieldset legend="Tài khoản nhận cọc">
        <p className="-mt-1 text-[13px] leading-relaxed text-ink-secondary">
          Cọc của khách chuyển thẳng vào tài khoản này. Sân Ngon không giữ tiền của bạn.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngân hàng" htmlFor="payout_bank" optional>
            <input id="payout_bank" name="payout_bank" maxLength={60} placeholder="MBBank" className={INPUT} />
          </Field>
          <Field label="Số tài khoản" htmlFor="payout_account" optional>
            <input id="payout_account" name="payout_account" maxLength={40} inputMode="numeric"
              placeholder="0987654321" className={INPUT} />
          </Field>
        </div>
      </Fieldset>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button type="submit" disabled={busy}
        className="h-13 self-start rounded-control bg-pitch px-8 text-base font-semibold text-pitch-ink disabled:opacity-60">
        {busy ? 'Đang gửi hồ sơ…' : 'Gửi hồ sơ đăng sân'}
      </button>
    </form>
  );
}

const INPUT = 'h-12 w-full rounded-control border border-hairline bg-card px-3.5 text-[15px]';

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-card border border-hairline bg-card p-5 lg:p-6">
      <legend className="px-1.5 text-[13px] font-semibold uppercase tracking-wider text-ink-secondary">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label, htmlFor, hint, optional, children,
}: {
  label: string; htmlFor: string; hint?: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-secondary">(không bắt buộc)</span>}
      </label>
      {children}
      {hint && <span className="text-xs leading-relaxed text-ink-secondary">{hint}</span>}
    </div>
  );
}
