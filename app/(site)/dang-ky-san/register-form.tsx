'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FileText, UploadCloud, X } from 'lucide-react';

type Bank = { code: string; name: string; shortName: string };
const STEPS = ['Người đại diện', 'Giấy tờ kinh doanh', 'Tài khoản nhận tiền'];

export function RegisterForm({ defaultName, defaultPhone }: { defaultName?: string | null; defaultPhone?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licenseDragging, setLicenseDragging] = useState(false);
  const stepRefs = useRef<Array<HTMLFieldSetElement | null>>([]);
  const licenseInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/banks').then((response) => response.json()).then((json: { banks?: Bank[] }) => setBanks(json.banks ?? [])).catch(() => setBanks([]));
  }, []);

  function validateStep(index: number) {
    const fields = stepRefs.current[index]?.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select') ?? [];
    const invalid = Array.from(fields).find((field) => !field.checkValidity());
    if (invalid) { invalid.reportValidity(); return false; }
    return true;
  }

  function chooseLicense(file?: File) {
    if (!file || !licenseInputRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    licenseInputRef.current.files = transfer.files;
    setLicenseFile(file);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateStep(step) || !event.currentTarget.checkValidity()) return;
    setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const license = form.get('business_license');
    if (!(license instanceof File) || license.size === 0) {
      setError('Bạn cần tải lên giấy tờ kinh doanh.'); setBusy(false); return;
    }
    const payload = new FormData();
    payload.set('data', JSON.stringify({
      full_name: String(form.get('full_name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      payout_bank: String(form.get('payout_bank') ?? ''),
      payout_account: String(form.get('payout_account') ?? ''),
    }));
    payload.set('business_license', license);
    try {
      const response = await fetch('/api/owner-registration', { method: 'POST', body: payload });
      if (response.status === 401) { router.push('/dang-nhap?next=/dang-ky-san'); return; }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error ?? 'Không gửi được hồ sơ. Thử lại sau vài giây.'); return; }
      router.refresh();
    } catch { setError('Không kết nối được. Kiểm tra mạng rồi thử lại.'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate aria-busy={busy} className="rounded-card border border-hairline bg-card p-5 sm:p-8 lg:p-10">
      <div className="border-b border-hairline pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Trở thành chủ sân</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-pitch">Đăng ký tài khoản chủ sân</h2>
        <p className="mt-2 text-sm leading-6 text-ink-secondary">Gửi thông tin để Sân Ngon xác minh. Sau khi được duyệt, bạn sẽ tạo cụm sân và thêm các sân con trong trang quản lý.</p>
      </div>

      <nav aria-label="Tiến độ đăng ký" className="mt-6 border-b border-hairline pb-6">
        <ol className="grid grid-cols-3 gap-2 sm:gap-4">
          {STEPS.map((label, index) => <li key={label} className="min-w-0"><div className={`flex items-center gap-2 text-xs ${index === step ? 'font-semibold text-pitch' : 'text-ink-secondary'}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index < step ? 'bg-pitch text-pitch-ink' : index === step ? 'border-2 border-pitch text-pitch' : 'border border-hairline'}`}>{index < step ? '✓' : index + 1}</span><span className="hidden truncate sm:block">{label}</span></div></li>)}
        </ol>
        <p className="mt-3 text-xs text-ink-secondary">Bước {step + 1}/{STEPS.length} · {STEPS[step]}</p>
      </nav>

      <div className="mt-7 flex flex-col gap-8">
        <Fieldset innerRef={(node) => { stepRefs.current[0] = node; }} hidden={step !== 0} number="01" legend="Người đại diện">
          <p className="-mt-1 text-sm leading-6 text-ink-secondary">Thông tin này giúp Sân Ngon xác minh đúng người quản lý các cụm sân.</p>
          <Field label="Họ và tên" htmlFor="full_name" required><input id="full_name" name="full_name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={defaultName ?? ''} placeholder="Nguyễn Văn A" className={INPUT} /></Field>
          <Field label="Số điện thoại" htmlFor="phone" required><input id="phone" name="phone" type="tel" required inputMode="numeric" pattern="0\d{9}" autoComplete="tel" defaultValue={defaultPhone ?? ''} placeholder="0987654321" className={INPUT} /></Field>
        </Fieldset>

        <Fieldset innerRef={(node) => { stepRefs.current[1] = node; }} hidden={step !== 1} number="02" legend="Giấy tờ kinh doanh">
          <p className="-mt-1 text-sm leading-6 text-ink-secondary">Tải lên giấy đăng ký hộ kinh doanh/doanh nghiệp hoặc giấy tờ chứng minh quyền khai thác sân.</p>
          <Field label="Giấy tờ" htmlFor="business_license" required hint="PDF, JPG hoặc PNG · tối đa 10MB.">
            <div onDragOver={(event) => { event.preventDefault(); setLicenseDragging(true); }} onDragLeave={() => setLicenseDragging(false)} onDrop={(event) => { event.preventDefault(); setLicenseDragging(false); chooseLicense(event.dataTransfer.files[0]); }} className={`rounded-control border-2 border-dashed p-3 ${licenseDragging ? 'border-pitch bg-free-fill' : 'border-strong bg-sunk'}`}>
              <label htmlFor="business_license" className="flex cursor-pointer flex-col items-center justify-center rounded-[calc(var(--radius-control)-4px)] border border-transparent px-4 py-7 text-center hover:border-strong hover:bg-card">
                <span className={`flex size-12 items-center justify-center rounded-full ${licenseFile ? 'bg-free-fill text-free-ink' : 'bg-card text-pitch'}`}>{licenseFile ? <Check className="size-6" aria-hidden="true" /> : <UploadCloud className="size-6" aria-hidden="true" />}</span>
                <span className="mt-3 text-sm font-semibold text-pitch">{licenseFile ? 'Đổi giấy tờ khác' : 'Kéo thả giấy tờ vào đây'}</span>
                <span className="mt-1 text-xs text-ink-secondary">hoặc bấm để chọn từ thiết bị</span>
                <input ref={licenseInputRef} id="business_license" name="business_license" type="file" required accept="application/pdf,image/jpeg,image/png" onChange={(event) => chooseLicense(event.target.files?.[0])} className="sr-only" />
              </label>
            </div>
            {licenseFile && <div className="mt-3 flex items-center gap-3 rounded-control border border-free-line bg-free-fill px-3.5 py-3"><FileText className="size-5 shrink-0 text-free-ink" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-free-ink">{licenseFile.name}</p><p className="mt-0.5 text-xs text-free-ink/80">{formatFileSize(licenseFile.size)} · Sẵn sàng gửi</p></div><button type="button" onClick={() => { if (licenseInputRef.current) licenseInputRef.current.value = ''; setLicenseFile(null); }} aria-label="Xóa giấy tờ đã chọn" className="flex size-8 items-center justify-center rounded-full text-free-ink hover:bg-card"><X className="size-4" /></button></div>}
          </Field>
        </Fieldset>

        <Fieldset innerRef={(node) => { stepRefs.current[2] = node; }} hidden={step !== 2} number="03" legend="Tài khoản nhận tiền">
          <div className="border-l-2 border-strong bg-sunk px-4 py-3 text-sm leading-6 text-ink-secondary">Tiền cọc sẽ được chuyển vào tài khoản này. Đây là thông tin bắt buộc để hồ sơ được duyệt.</div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Ngân hàng" htmlFor="payout_bank" required><select id="payout_bank" name="payout_bank" required defaultValue="" className={INPUT}><option value="" disabled>{banks.length ? 'Chọn ngân hàng' : 'Đang tải danh sách ngân hàng…'}</option>{banks.map((bank) => <option key={bank.code} value={bank.shortName}>{bank.shortName}</option>)}</select></Field><Field label="Số tài khoản" htmlFor="payout_account" required hint="6–30 chữ số."><input id="payout_account" name="payout_account" required minLength={6} maxLength={30} pattern="[0-9]{6,30}" inputMode="numeric" autoComplete="off" placeholder="0123456789" className={INPUT} /></Field></div>
        </Fieldset>
      </div>

      {error && <p role="alert" className="mt-6 border-l-2 border-danger bg-[#FFF5F5] px-4 py-3 text-sm leading-6 text-danger">{error}</p>}
      <div className="mt-8 flex flex-col items-start gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xs text-xs leading-5 text-ink-secondary">Bằng việc gửi, bạn đồng ý để Sân Ngon liên hệ xác minh thông tin.</p><div className="flex w-full gap-3 sm:w-auto">{step > 0 && <button type="button" onClick={() => { setError(null); setStep((current) => current - 1); }} className="min-h-13 flex-1 rounded-control border border-hairline px-6 font-semibold text-pitch sm:flex-none">Quay lại</button>}{step < STEPS.length - 1 ? <button type="button" onClick={() => { setError(null); if (validateStep(step)) setStep((current) => current + 1); }} className="min-h-13 flex-1 rounded-control bg-pitch px-7 font-semibold text-pitch-ink sm:flex-none">Tiếp theo <span aria-hidden="true" className="ml-3">→</span></button> : <button type="submit" disabled={busy} className="min-h-13 flex-1 rounded-control bg-pitch px-7 font-semibold text-pitch-ink disabled:opacity-60 sm:flex-none">{busy ? 'Đang gửi hồ sơ…' : 'Gửi hồ sơ chủ sân'} <span aria-hidden="true" className="ml-3">→</span></button>}</div></div>
    </form>
  );
}

const INPUT = 'h-12 w-full rounded-control border border-hairline bg-page px-3.5 text-[15px] outline-none transition-colors placeholder:text-ink-secondary/70 focus:border-pitch focus:ring-2 focus:ring-strong';
function formatFileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function Fieldset({ number, legend, children, hidden, innerRef }: { number: string; legend: string; children: ReactNode; hidden?: boolean; innerRef?: (node: HTMLFieldSetElement | null) => void }) { return <fieldset ref={innerRef} hidden={hidden} className="flex flex-col gap-4"><legend className="mb-1 flex items-center gap-3 text-base font-semibold text-pitch"><span className="flex size-7 items-center justify-center rounded-full bg-free-fill text-xs font-bold text-free-ink">{number}</span>{legend}</legend>{children}</fieldset>; }
function Field({ label, htmlFor, hint, required, children }: { label: string; htmlFor: string; hint?: string; required?: boolean; children: ReactNode }) { return <div className="flex flex-col gap-1.5"><label htmlFor={htmlFor} className="text-sm font-semibold">{label}{required && <span className="ml-1 text-danger" aria-hidden="true">*</span>}</label>{children}{hint && <span className="text-xs text-ink-secondary">{hint}</span>}</div>; }
