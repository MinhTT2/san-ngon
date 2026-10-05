'use client';
import { useState } from 'react';
import Image from 'next/image';
import { CalendarDays, Check, MapPin, ShieldCheck, Trophy, Users } from 'lucide-react';
import { SPORT_LABELS } from '@/lib/constants';
import { vnd } from '@/lib/format';
import { Field, fieldClass } from './form-field';
import { TournamentPhotoUpload } from './tournament-photo-upload';
import { tournamentCoverSrc } from '@/lib/image-upload';

const inputClass = `${fieldClass} min-h-12 bg-card px-4`;
const sectionClass = 'min-w-0 scroll-mt-28 space-y-6 border-b border-hairline pb-8';
function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="flex items-start gap-4 border-b border-hairline pb-6"><span className="grid size-10 shrink-0 place-items-center rounded-control bg-free-fill font-display text-sm font-bold text-pitch">{number}</span><div><h2 className="font-display text-xl font-bold text-pitch sm:text-2xl">{title}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{description}</p></div></div>;
}
export function TournamentFields({ userId, courts, initial, owner = false }: { userId: string; initial?: Record<string, string | number>; owner?: boolean; courts: { id: string; name: string; venue: string; address: string; sport: string }[] }) {
  const [cover, setCover] = useState<string | null>(tournamentCoverSrc(String(initial?.cover_path ?? '')));
  const [values, setValues] = useState<Record<string, string | number>>({ sport: courts[0]?.sport ?? Object.keys(SPORT_LABELS)[0], entry_fee: 0, deposit_amount: 0, ...initial });
  const sport = String(values.sport);
  const court = courts.find(c => c.id === values.court_id && c.sport === sport);
  const start = String(values.starts_at ?? '');
  const paymentDeadline = String(values.payment_deadline ?? '');
  return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" onChange={event => {
    const input = event.target;
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) {
      setValues(current => ({ ...current, [input.name]: input.value, ...(input.name === 'sport' ? { court_id: '' } : {}) }));
    }
  }}>
    <div className="min-w-0 space-y-6">
      <section id="thong-tin-giai" className={sectionClass}>
        <SectionHeading number="01" title="Bắt đầu từ một ý tưởng" description="Một cái tên dễ nhớ, một môn chơi bạn yêu thích." />
        <Field label="Tên giải đấu"><input className={inputClass} name="title" defaultValue={initial?.title} placeholder="Ví dụ: Cầu lông cuối tuần Cầu Giấy" required minLength={3} maxLength={150} /></Field>
        <TournamentPhotoUpload userId={userId} initialPath={String(initial?.cover_path ?? '')} onPreview={setCover} />
        <Field label="Môn thi đấu"><select className={inputClass} name="sport" value={sport} onChange={() => {}}>{Object.entries(SPORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label={owner ? 'Chọn sân của bạn' : 'Sân tổ chức'}><select className={inputClass} name="court_id" required={owner} value={court?.id ?? ''} onChange={() => {}}><option value="">{owner ? 'Chọn sân đang hoạt động' : 'Nhờ admin bố trí sân'}</option>{courts.filter(c => c.sport === sport).map(c => <option key={c.id} value={c.id}>{c.venue} · {c.name}</option>)}</select></Field>
        {owner ? <><Field label="Địa chỉ sân tổ chức"><input className={`${inputClass} bg-sunk`} name="address" value={court?.address ?? ''} readOnly placeholder="Chọn sân để xem địa chỉ" /></Field>{!courts.some(c => c.sport === sport) && <p role="status" className="text-sm leading-6 text-danger">Bạn chưa có sân đang hoạt động cho môn này. Chọn môn khác hoặc cập nhật sân trong mục quản lý.</p>}</> : <Field label="Địa chỉ / khu vực mong muốn"><input className={inputClass} name="address" defaultValue={initial?.address} placeholder="Ví dụ: Cầu Giấy, Hà Nội" required minLength={5} maxLength={300} /></Field>}
      </section>
      <section id="lich-thi-dau" className={sectionClass}>
        <SectionHeading number="02" title="Hẹn ngày ra sân" description="Chọn lịch thi đấu và thời hạn để mọi người chuẩn bị. Tất cả thời gian là giờ Việt Nam." />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Bắt đầu thi đấu"><input className={inputClass} type="datetime-local" name="starts_at" defaultValue={initial?.starts_at} required /></Field>
          <Field label="Kết thúc thi đấu"><input className={inputClass} type="datetime-local" name="ends_at" min={start || undefined} defaultValue={initial?.ends_at} required /></Field>
        </div>
        <div className="space-y-5 border-l-2 border-strong pl-4 sm:pl-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-pitch"><CalendarDays size={17} aria-hidden="true" />Lịch đăng ký & đóng cọc</p>
          <div className="grid gap-5 sm:grid-cols-2"><Field label="Hạn nhận và duyệt đăng ký"><input className={inputClass} type="datetime-local" name="registration_deadline" max={paymentDeadline || start || undefined} defaultValue={initial?.registration_deadline} required /></Field><Field label="Hạn đóng cọc cuối cùng"><input className={inputClass} type="datetime-local" name="payment_deadline" min={String(values.registration_deadline || '') || undefined} max={start || undefined} defaultValue={initial?.payment_deadline} required /></Field></div>
          <p className="text-xs leading-6 text-ink-secondary">Đóng đăng ký trước hạn cọc. Hạn cọc không được muộn hơn giờ bắt đầu thi đấu.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Thời gian đóng cọc sau duyệt (giờ)"><input className={inputClass} type="number" name="payment_hold_hours" min={1} max={72} defaultValue={initial?.payment_hold_hours ?? 24} required /></Field><Field label="Số người / đội tối đa"><input className={inputClass} type="number" name="capacity" defaultValue={initial?.capacity} min={2} max={1000} placeholder="Ví dụ: 16" required /></Field></div>
        <p className="text-xs leading-6 text-ink-secondary">Mỗi tài khoản đăng ký một suất. Ghi rõ một suất là một người hay một đội trong thể lệ. Thời gian giữ suất không vượt quá hạn cọc cuối cùng.</p>
      </section>
      <section id="le-phi" className={sectionClass}>
        <SectionHeading number="03" title="Rõ ràng trước giờ thi đấu" description="Công khai lệ phí và thể lệ để người tham gia biết điều gì đang chờ mình." />
        <div className="grid gap-5 sm:grid-cols-2"><Field label="Lệ phí mỗi suất (đ)"><input className={inputClass} type="number" name="entry_fee" min={0} max={100000000} defaultValue={initial?.entry_fee ?? 0} required /></Field><Field label="Cọc mỗi suất (đ)"><input className={inputClass} type="number" name="deposit_amount" min={0} max={Number(values.entry_fee) || 0} defaultValue={initial?.deposit_amount ?? 0} required /></Field></div>
        <p className="rounded-control bg-free-fill p-4 text-sm leading-7 text-pitch">Giải miễn phí? Để lệ phí và cọc bằng 0. Cọc không vượt lệ phí; người được duyệt mới chuyển cọc, phần còn lại nộp khi tham gia.</p>
        <Field label="Thể lệ & thông tin liên hệ"><textarea className={inputClass} name="description" defaultValue={initial?.description} placeholder={'Giải dành cho ai? Trình độ và độ tuổi phù hợp?\nThi đấu cá nhân hay theo đội? Thể thức và lịch có mặt?\nCần mang dụng cụ gì? Liên hệ ban tổ chức thế nào?'} required minLength={10} maxLength={5000} rows={7} /></Field>
        <details className="rounded-control border border-hairline px-4"><summary className="flex min-h-12 list-none items-center justify-between gap-3 text-sm font-semibold text-pitch">Chính sách cọc & hoàn tiền<span aria-hidden="true">+</span></summary><p className="pb-4 text-xs leading-7 text-ink-secondary">Cọc chuyển vào tài khoản chủ sân và được xác nhận tự động. Tự hủy trước giờ bắt đầu ít nhất 24 giờ được hoàn toàn bộ cọc; muộn hơn không hoàn. Ban tổ chức hủy suất hoặc giải luôn hoàn toàn bộ. Chủ sân hoàn tiền thủ công.</p></details>
      </section>
      <div className="flex items-start gap-3 px-1 py-2"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-pitch" aria-hidden="true" /><p className="text-xs leading-6 text-ink-secondary">{owner ? 'Kiểm tra kỹ lịch và thể lệ trước khi công khai. Giải sẽ mở đăng ký ngay và khóa lịch sân; lịch, giá và chính sách không thể sửa sau khi công khai.' : 'Đề xuất sẽ được admin kiểm tra và bố trí sân trước khi công khai. Bạn có thể chỉnh sửa khi đang chờ duyệt hoặc cần bổ sung.'}</p></div>
    </div>
    <aside aria-label="Xem trước giải đấu" className="min-w-0 space-y-5 lg:sticky lg:top-24">
      <div className="overflow-hidden rounded-card border border-strong bg-card">
        {cover && <div className="relative aspect-video bg-sunk"><Image src={cover} alt="Ảnh bìa giải của bạn" fill unoptimized className="object-cover" /></div>}
        <div className="flex items-center justify-between border-b border-strong bg-free-fill px-5 py-4"><p className="text-xs font-bold uppercase tracking-[0.14em] text-pitch">Giải của bạn</p><Trophy size={19} className="text-pitch" aria-hidden="true" /></div>
        <div className="p-5"><span className="inline-flex rounded-pill border border-hairline px-3 py-1 text-xs font-semibold text-pitch">{SPORT_LABELS[sport]}</span><h2 className="mt-4 break-words font-display text-2xl font-bold leading-tight text-pitch">{values.title || 'Tên giải đấu của bạn'}</h2>
          <dl className="my-5 space-y-4 text-sm"><div className="flex gap-3"><CalendarDays size={17} className="mt-0.5 shrink-0 text-ink-secondary" aria-hidden="true" /><div><dt className="text-xs text-ink-secondary">Ngày thi đấu</dt><dd className="mt-1 font-medium">{start ? `${start.slice(8, 10)}/${start.slice(5, 7)}/${start.slice(0, 4)} · ${start.slice(11, 16)}` : 'Chưa chọn lịch'}</dd></div></div><div className="flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-ink-secondary" aria-hidden="true" /><div className="min-w-0"><dt className="text-xs text-ink-secondary">Địa điểm</dt><dd className="mt-1 break-words font-medium">{court ? `${court.venue} · ${court.name}` : owner ? 'Chưa chọn sân' : values.address || 'Admin hỗ trợ bố trí sân'}</dd></div></div><div className="flex gap-3"><Users size={17} className="mt-0.5 shrink-0 text-ink-secondary" aria-hidden="true" /><div><dt className="text-xs text-ink-secondary">Quy mô</dt><dd className="mt-1 font-medium">{values.capacity ? `${values.capacity} người / đội` : 'Chưa chọn số suất'}</dd></div></div></dl>
          <div className="border-t border-hairline pt-5"><p className="text-xs text-ink-secondary">Lệ phí mỗi suất</p><p className="mt-2 font-display text-3xl font-bold text-pitch">{Number(values.entry_fee) > 0 ? vnd(Number(values.entry_fee)) : 'Miễn phí'}</p><p className="mt-2 text-xs leading-6 text-ink-secondary">{Number(values.deposit_amount) > 0 ? `Cọc ${vnd(Number(values.deposit_amount))} sau khi được duyệt` : 'Không yêu cầu cọc'}</p></div>
        </div>
      </div>
      <nav aria-label="Các phần tạo giải" className="hidden border-t border-hairline pt-5 lg:block"><p className="mb-3 text-xs font-semibold text-ink-secondary">HOÀN THIỆN GIẢI ĐẤU</p>{[['thong-tin-giai', 'Thông tin & địa điểm'], ['lich-thi-dau', 'Lịch & quy mô'], ['le-phi', 'Lệ phí & thể lệ']].map(([id, label], index) => <a key={id} href={`#${id}`} className="flex min-h-11 items-center gap-3 text-sm text-pitch hover:underline"><span className="text-xs text-ink-secondary">0{index + 1}</span>{label}</a>)}</nav>
      <p className="flex items-start gap-2 px-1 text-xs leading-6 text-ink-secondary"><Check size={16} className="mt-1 shrink-0 text-pitch" aria-hidden="true" />{owner ? 'Tự công khai tại sân của bạn. Không cần admin duyệt.' : 'Admin duyệt đề xuất và hỗ trợ bố trí địa điểm.'}</p>
    </aside>
  </div>;
}
