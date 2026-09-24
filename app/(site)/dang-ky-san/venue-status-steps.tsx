import Link from 'next/link';
import { Check, Clock3, FileCheck2, Mail, MessageCircle } from 'lucide-react';

const STEPS = [
  ['Đã nhận hồ sơ và giấy tờ', 'Chúng tôi đã nhận thông tin và giấy tờ kinh doanh của bạn.'],
  ['Đang xác minh', 'Chúng tôi kiểm tra giấy tờ và gọi vào số bạn để lại nếu cần.'],
  ['Tạo cụm sân', 'Sau khi duyệt, bạn tự thêm địa chỉ, môn thể thao và sân con.'],
  ['Bắt đầu nhận đặt', 'Cụm sân sẽ sẵn sàng để bạn quản lý lịch và nhận đơn.'],
] as const;

export function OwnerStatusSteps({ status }: { status: 'pending' | 'rejected' }) {
  if (status === 'rejected') {
    return <div className="mx-auto max-w-5xl overflow-hidden rounded-card border border-hairline bg-card lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <div className="bg-pitch px-7 py-9 text-pitch-ink sm:px-10 sm:py-12">
        <span className="inline-flex rounded-pill bg-white/10 px-3 py-1 text-xs font-semibold text-white">Cần bổ sung thông tin</span>
        <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Hồ sơ cần được cập nhật.</h1>
        <p className="mt-4 text-sm leading-7 text-pitch-ink/75">Chúng tôi chưa thể duyệt hồ sơ lần này. Liên hệ để biết chính xác giấy tờ hoặc thông tin cần bổ sung.</p>
        <Link href="/dang-ky-san?resubmit=1" className="mt-8 inline-flex min-h-12 items-center rounded-control bg-white px-5 font-semibold text-pitch">Cập nhật và gửi lại hồ sơ <span aria-hidden="true" className="ml-3">→</span></Link>
      </div>
      <div className="p-7 sm:p-10"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Bước tiếp theo</p><div className="mt-5 flex gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-peak-fill text-peak-ink"><MessageCircle className="size-5" aria-hidden="true" /></span><div><h2 className="font-display text-xl font-bold text-pitch">Cập nhật thông tin cần bổ sung</h2><p className="mt-1 text-sm leading-6 text-ink-secondary">Bạn có thể gửi lại hồ sơ sau khi sửa thông tin hoặc thay giấy tờ.</p></div></div></div>
    </div>;
  }

  return <div className="mx-auto max-w-5xl overflow-hidden rounded-card border border-hairline bg-card lg:grid lg:grid-cols-[0.9fr_1.1fr]">
    <div className="bg-pitch px-7 py-9 text-pitch-ink sm:px-10 sm:py-12">
      <span className="inline-flex items-center gap-2 rounded-pill bg-peak-fill px-3 py-1 text-xs font-semibold text-peak-ink"><Clock3 className="size-3.5" aria-hidden="true" /> Đang chờ duyệt</span>
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Hồ sơ đang được xử lý.</h1>
      <p className="mt-4 text-sm leading-7 text-pitch-ink/75">Bạn đã hoàn tất bước gửi thông tin. Khi có kết quả, Sân Ngon sẽ báo ngay để bạn bắt đầu đăng sân.</p>
      <div className="mt-8 border-t border-white/15 pt-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-free-line">Bạn sẽ nhận được</p><div className="mt-4 space-y-3 text-sm"><p className="flex items-center gap-3"><Mail className="size-4 text-free-line" aria-hidden="true" /> Email đến địa chỉ đăng nhập</p><p className="flex items-center gap-3"><MessageCircle className="size-4 text-free-line" aria-hidden="true" /> Thông báo trong tài khoản</p></div></div>
    </div>
    <div className="p-7 sm:p-10"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-pitch">Tiến độ hồ sơ</p><h2 className="mt-2 font-display text-2xl font-bold text-pitch">Còn một bước xác minh</h2></div><FileCheck2 className="size-8 text-free-line" aria-hidden="true" /></div><ol className="mt-8">{STEPS.map(([title, body], index) => <li key={title} className="flex gap-4"><div className="flex flex-none flex-col items-center"><span className={`flex size-9 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-pitch text-pitch-ink' : index === 1 ? 'border-2 border-pitch bg-card text-pitch' : 'border border-hairline bg-card text-ink-secondary'}`}>{index < 1 ? <Check className="size-4" aria-hidden="true" /> : index + 1}</span>{index < STEPS.length - 1 && <span className={`w-px flex-grow ${index < 1 ? 'bg-pitch' : 'bg-hairline'}`} />}</div><div className={`pb-7 ${index === 1 ? '' : 'opacity-60'}`}><h3 className="text-[16px] font-semibold">{title}</h3><p className="mt-1 text-sm leading-6 text-ink-secondary">{body}</p></div></li>)}</ol><Link href="/thong-bao" className="inline-flex min-h-11 items-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch hover:bg-free-fill">Mở thông báo <span aria-hidden="true" className="ml-2">↗</span></Link></div>
  </div>;
}
