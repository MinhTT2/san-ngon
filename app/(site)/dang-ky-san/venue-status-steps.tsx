import Link from 'next/link';

const STEPS = [
  ['Đã nhận hồ sơ và giấy tờ', 'Chúng tôi đã nhận thông tin và giấy tờ kinh doanh của bạn.'],
  ['Đang xác minh', 'Chúng tôi kiểm tra giấy tờ và gọi vào số bạn để lại nếu cần.'],
  ['Tạo cụm sân', 'Sau khi duyệt, bạn tự thêm địa chỉ, môn thể thao và sân con.'],
  ['Bắt đầu nhận đặt', 'Cụm sân sẽ sẵn sàng để bạn quản lý lịch và nhận đơn.'],
] as const;

export function OwnerStatusSteps({ status }: { status: 'pending' | 'rejected' }) {
  if (status === 'rejected') return <div className="mx-auto max-w-3xl rounded-card border border-hairline bg-card p-7 sm:p-10"><span className="rounded-pill bg-sunk px-3 py-1 text-xs font-semibold text-danger">Cần bổ sung thông tin</span><h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-pitch">Hồ sơ chủ sân chưa được duyệt</h1><p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">Gọi cho chúng tôi để biết cần cập nhật gì và mở lại hồ sơ.</p><Link href="/lien-he" className="mt-5 inline-flex min-h-13 items-center rounded-control bg-pitch px-7 font-semibold text-pitch-ink">Liên hệ</Link></div>;
  return <div className="mx-auto max-w-3xl rounded-card border border-hairline bg-card p-7 sm:p-10"><span className="inline-flex rounded-pill bg-peak-fill px-3 py-1 text-[13px] font-medium text-peak-ink">Đang chờ duyệt</span><h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-pitch sm:text-4xl">Hồ sơ chủ sân đang được xử lý.</h1><p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">Khi được duyệt, nút tạo cụm sân sẽ xuất hiện trong trang này.</p><ol className="mt-8 flex flex-col border-t border-hairline pt-7">{STEPS.map(([title, body], index) => <li key={title} className="flex gap-4"><div className="flex flex-none flex-col items-center"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${index === 0 ? 'bg-pitch text-pitch-ink' : index === 1 ? 'border-2 border-pitch bg-card text-pitch' : 'border border-hairline bg-card text-ink-secondary'}`}>{index < 1 ? '✓' : index + 1}</span>{index < STEPS.length - 1 && <span className={`w-px flex-grow ${index < 1 ? 'bg-pitch' : 'bg-hairline'}`} />}</div><div className={`flex flex-col gap-1 pb-7 ${index === 1 ? '' : 'opacity-70'}`}><span className="text-[17px] font-semibold">{title}</span><p className="text-[15px] leading-relaxed text-ink-secondary">{body}</p></div></li>)}</ol></div>;
}
