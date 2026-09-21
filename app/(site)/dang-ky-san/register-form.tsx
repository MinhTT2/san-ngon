'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DISTRICTS, SPORT_LABELS } from '@/lib/constants';
import { vnd } from '@/lib/format';

type SportRow = { sport: string; courtCount: string; price: string };
const SPORT_KEYS = Object.keys(SPORT_LABELS);
const MAX_SPORTS = 6;
const STEPS = ['Người đại diện', 'Cụm sân', 'Môn thể thao', 'Giấy tờ', 'Tài khoản nhận tiền'];

export function RegisterForm({ defaultName, defaultPhone }: { defaultName?: string | null; defaultPhone?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const stepRefs = useRef<Array<HTMLFieldSetElement | null>>([]);
  const [sports, setSports] = useState<SportRow[]>([
    { sport: 'football5', courtCount: '4', price: '250000' },
  ]);

  function updateSport(index: number, patch: Partial<SportRow>) {
    setSports((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function addSport() {
    const next = SPORT_KEYS.find((key) => !sports.some((item) => item.sport === key));
    if (next) setSports((current) => [...current, { sport: next, courtCount: '2', price: '150000' }]);
  }

  function removeSport(index: number) {
    if (sports.length > 1) setSports((current) => current.filter((_, i) => i !== index));
  }

  function validateStep(index: number) {
    const fields = stepRefs.current[index]?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea') ?? [];
    const invalid = Array.from(fields).find((field) => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  }

  function nextStep() {
    setError(null);
    if (validateStep(step)) setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateStep(step) || !e.currentTarget.checkValidity()) return;
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const body = {
      full_name: String(f.get('full_name') ?? ''),
      name: String(f.get('name') ?? ''),
      address: String(f.get('address') ?? ''),
      district: String(f.get('district') ?? ''),
      phone: String(f.get('phone') ?? ''),
      description: String(f.get('description') ?? '') || undefined,
      open_time: String(f.get('open_time') ?? ''),
      close_time: String(f.get('close_time') ?? ''),
      sports: sports.map((item) => ({
        sport: item.sport,
        court_count: Number(item.courtCount),
        price_per_hour: Number(item.price),
      })),
      payout_bank: String(f.get('payout_bank') ?? ''),
      payout_account: String(f.get('payout_account') ?? ''),
    };

    try {
      const license = f.get('business_license');
      if (!(license instanceof File) || license.size === 0) {
        setError('Bạn cần tải lên giấy tờ kinh doanh.');
        return;
      }
      const payload = new FormData();
      payload.set('data', JSON.stringify(body));
      payload.set('business_license', license);
      const res = await fetch('/api/venues', {
        method: 'POST',
        body: payload,
      });
      if (res.status === 401) {
        router.push('/dang-nhap?next=/dang-ky-san');
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? 'Không gửi được hồ sơ. Kiểm tra lại thông tin rồi thử lại.');
        return;
      }
      router.refresh();
    } catch {
      setError('Không kết nối được. Kiểm tra mạng rồi thử gửi lại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={busy} className="rounded-card border border-hairline bg-card p-5 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Bắt đầu đăng sân</p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-pitch">Thông tin cụm sân</h2>
          <p className="mt-2 text-sm leading-6 text-ink-secondary">Mất khoảng 3 phút. Bạn có thể bổ sung chi tiết sau khi hồ sơ được duyệt.</p>
        </div>
        <span className="rounded-pill bg-free-fill px-3 py-1 text-xs font-medium text-free-ink">Miễn phí đăng ký</span>
      </div>

      <nav aria-label="Tiến độ đăng ký" className="mt-6 border-b border-hairline pb-6">
        <ol className="grid grid-cols-5 gap-1 sm:gap-3">
          {STEPS.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return <li key={label} className="min-w-0">
              <div className={`flex items-center gap-2 text-xs ${current ? 'font-semibold text-pitch' : 'text-ink-secondary'}`}>
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-pitch text-pitch-ink' : current ? 'border-2 border-pitch text-pitch' : 'border border-hairline'}`}>{done ? '✓' : index + 1}</span>
                <span className="hidden truncate sm:block">{label}</span>
              </div>
            </li>;
          })}
        </ol>
        <p className="mt-3 text-xs text-ink-secondary">Bước {step + 1}/{STEPS.length} · {STEPS[step]}</p>
      </nav>

      <div className="mt-7 flex flex-col gap-8">
        <Fieldset innerRef={(node) => { stepRefs.current[0] = node; }} hidden={step !== 0} number="01" legend="Người đại diện">
          <p className="-mt-1 text-sm leading-6 text-ink-secondary">Thông tin này giúp Sân Ngon xác minh đúng người quản lý cụm sân.</p>
          <Field label="Họ và tên" htmlFor="full_name" required>
            <input id="full_name" name="full_name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={defaultName ?? ''} placeholder="Nguyễn Văn A" className={INPUT} />
          </Field>
        </Fieldset>

        <Fieldset innerRef={(node) => { stepRefs.current[1] = node; }} hidden={step !== 1} number="02" legend="Cụm sân của bạn">
          <Field label="Tên cụm sân" htmlFor="name" required>
            <input id="name" name="name" required minLength={3} maxLength={120} autoComplete="organization" placeholder="Ví dụ: Sân bóng Mỹ Đình" className={INPUT} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <Field label="Địa chỉ" htmlFor="address" required>
              <input id="address" name="address" required minLength={3} maxLength={200} autoComplete="street-address" placeholder="Số nhà, đường, phường/xã" className={INPUT} />
            </Field>
            <Field label="Quận/huyện" htmlFor="district" required>
              <select id="district" name="district" required defaultValue="" className={INPUT}>
                <option value="" disabled>Chọn quận/huyện</option>
                {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Số điện thoại tại sân" htmlFor="phone" required hint="Số khách gọi khi cần hỗ trợ trong ngày đặt sân.">
            <input id="phone" name="phone" type="tel" required inputMode="numeric" pattern="0\d{9}" autoComplete="tel" defaultValue={defaultPhone ?? ''} placeholder="0987654321" className={INPUT} />
          </Field>
          <Field label="Giới thiệu ngắn" htmlFor="description" optional hint="Không bắt buộc · tối đa 500 ký tự.">
            <textarea id="description" name="description" rows={3} maxLength={500} placeholder="Ví dụ: cỏ nhân tạo, đèn cao áp, có mái che một phần…" className={`${INPUT} h-auto resize-y py-3`} />
          </Field>
        </Fieldset>

        <Fieldset innerRef={(node) => { stepRefs.current[2] = node; }} hidden={step !== 2} number="03" legend="Môn thể thao và giá khởi điểm">
          <p className="-mt-1 text-sm leading-6 text-ink-secondary">Thêm từng môn bạn đang có. Mỗi môn có số sân và mức giá riêng; tổng cộng tối đa 20 sân.</p>
          <div className="flex flex-col gap-3">
            {sports.map((item, index) => {
              const selectedByOther = new Set(sports.filter((_, i) => i !== index).map((sport) => sport.sport));
              const price = Number(item.price);
              return (
                <div key={`${item.sport}-${index}`} className="rounded-control border border-hairline bg-sunk p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-pitch">Môn {index + 1}</h3>
                    {sports.length > 1 && <button type="button" onClick={() => removeSport(index)} className="text-xs font-medium text-ink-secondary underline underline-offset-4 hover:text-danger">Xóa môn này</button>}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Môn thể thao" htmlFor={`sport-${index}`} required>
                      <select id={`sport-${index}`} value={item.sport} onChange={(e) => updateSport(index, { sport: e.target.value })} className={INPUT}>
                        {SPORT_KEYS.map((key) => <option key={key} value={key} disabled={selectedByOther.has(key)}>{SPORT_LABELS[key]}</option>)}
                      </select>
                    </Field>
                    <Field label="Số sân" htmlFor={`court-count-${index}`} required>
                      <input id={`court-count-${index}`} type="number" min={1} max={20} required value={item.courtCount} onChange={(e) => updateSport(index, { courtCount: e.target.value })} inputMode="numeric" className={INPUT} />
                    </Field>
                  </div>
                  <Field label="Giá thuê tham khảo / giờ" htmlFor={`price-${index}`} required hint={price >= 1000 ? `${vnd(price)}/giờ, áp dụng cả tuần. Bạn sẽ chỉnh bảng giá chi tiết sau.` : 'Nhập số tiền từ 1.000đ đến 10.000.000đ.'}>
                    <div className="relative">
                      <input id={`price-${index}`} type="number" required min={1000} max={10000000} step={1000} inputMode="numeric" value={item.price} onChange={(e) => updateSport(index, { price: e.target.value })} className={`${INPUT} pr-10`} />
                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-secondary">đ</span>
                    </div>
                  </Field>
                </div>
              );
            })}
          </div>
          {sports.length < MAX_SPORTS && <button type="button" onClick={addSport} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-control border border-hairline px-4 text-sm font-semibold text-pitch hover:border-strong">+ Thêm môn khác</button>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mở cửa từ" htmlFor="open_time" required>
              <input id="open_time" name="open_time" type="time" required defaultValue="05:00" className={INPUT} />
            </Field>
            <Field label="Đóng cửa lúc" htmlFor="close_time" required>
              <input id="close_time" name="close_time" type="time" required defaultValue="23:00" className={INPUT} />
            </Field>
          </div>
        </Fieldset>

        <Fieldset innerRef={(node) => { stepRefs.current[3] = node; }} hidden={step !== 3} number="04" legend="Giấy tờ kinh doanh">
          <p className="-mt-1 text-sm leading-6 text-ink-secondary">Tải lên giấy đăng ký hộ kinh doanh/doanh nghiệp hoặc giấy tờ chứng minh quyền khai thác sân. Sân Ngon chỉ mở lịch sau khi kiểm tra giấy tờ.</p>
          <Field label="Giấy tờ" htmlFor="business_license" required hint="PDF, JPG hoặc PNG · tối đa 10MB.">
            <input id="business_license" name="business_license" type="file" required accept="application/pdf,image/jpeg,image/png" className="block w-full rounded-control border border-hairline bg-page px-3.5 py-3 text-sm file:mr-4 file:rounded-control file:border-0 file:bg-sunk file:px-3 file:py-2 file:font-semibold" />
          </Field>
        </Fieldset>

        <Fieldset innerRef={(node) => { stepRefs.current[4] = node; }} hidden={step !== 4} number="05" legend="Tài khoản nhận tiền">
          <div className="border-l-2 border-strong bg-sunk px-4 py-3 text-sm leading-6 text-ink-secondary">Tiền cọc sẽ được chuyển vào tài khoản này. Đây là thông tin bắt buộc để hồ sơ được duyệt.</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ngân hàng" htmlFor="payout_bank" required>
              <input id="payout_bank" name="payout_bank" required minLength={2} maxLength={60} autoComplete="off" placeholder="Ví dụ: MBBank" className={INPUT} />
            </Field>
            <Field label="Số tài khoản" htmlFor="payout_account" required hint="6–30 chữ số.">
              <input id="payout_account" name="payout_account" required minLength={6} maxLength={30} pattern="[0-9]{6,30}" inputMode="numeric" autoComplete="off" placeholder="0123456789" className={INPUT} />
            </Field>
          </div>
        </Fieldset>
      </div>

      {error && <p role="alert" className="mt-6 border-l-2 border-danger bg-[#FFF5F5] px-4 py-3 text-sm leading-6 text-danger">{error}</p>}
      <div className="mt-8 flex flex-col items-start gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xs text-xs leading-5 text-ink-secondary">Bằng việc gửi, bạn đồng ý để Sân Ngon liên hệ xác minh thông tin sân.</p>
        <div className="flex w-full gap-3 sm:w-auto">
          {step > 0 && <button type="button" onClick={() => { setError(null); setStep((current) => current - 1); }} className="min-h-13 flex-1 rounded-control border border-hairline px-6 font-semibold text-pitch sm:flex-none">Quay lại</button>}
          {step < STEPS.length - 1 ? <button type="button" onClick={nextStep} className="min-h-13 flex-1 rounded-control bg-pitch px-7 font-semibold text-pitch-ink sm:flex-none">Tiếp theo <span aria-hidden="true" className="ml-3">→</span></button> : <button type="submit" disabled={busy} className="min-h-13 flex-1 rounded-control bg-pitch px-7 font-semibold text-pitch-ink transition-opacity disabled:opacity-60 sm:flex-none">{busy ? 'Đang gửi hồ sơ…' : 'Gửi hồ sơ đăng sân'} <span aria-hidden="true" className="ml-3">→</span></button>}
        </div>
      </div>
    </form>
  );
}

const INPUT = 'h-12 w-full rounded-control border border-hairline bg-page px-3.5 text-[15px] outline-none transition-colors placeholder:text-ink-secondary/70 focus:border-pitch focus:ring-2 focus:ring-strong';

function Fieldset({ number, legend, children, hidden, innerRef }: { number: string; legend: string; children: ReactNode; hidden?: boolean; innerRef?: (node: HTMLFieldSetElement | null) => void }) {
  return <fieldset ref={innerRef} hidden={hidden} className="flex flex-col gap-4"><legend className="mb-1 flex items-center gap-3 text-base font-semibold text-pitch"><span className="flex size-7 items-center justify-center rounded-full bg-free-fill text-xs font-bold text-free-ink">{number}</span>{legend}</legend>{children}</fieldset>;
}

function Field({ label, htmlFor, hint, optional, required, children }: { label: string; htmlFor: string; hint?: string; optional?: boolean; required?: boolean; children: ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label htmlFor={htmlFor} className="text-sm font-semibold">{label}{required && <span className="ml-1 text-danger" aria-hidden="true">*</span>}{optional && <span className="ml-1.5 font-normal text-ink-secondary">(không bắt buộc)</span>}</label>{children}{hint && <span className="text-xs leading-5 text-ink-secondary">{hint}</span>}</div>;
}
