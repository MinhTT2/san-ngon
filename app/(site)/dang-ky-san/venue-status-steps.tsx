import Link from 'next/link';
import { VENUE_STATUS_LABELS } from '@/lib/constants';
import type { OwnerVenue } from '@/lib/types';

/**
 * Bốn bước hồ sơ. Chủ sân vừa gửi xong chỉ có một câu hỏi: bao giờ thì sân
 * của tôi lên? Nên trang này trả lời đúng câu đó và không gì khác.
 */
const STEPS = [
  ['Đã nhận hồ sơ và giấy tờ', 'Chúng tôi đã nhận thông tin cụm sân và giấy tờ kinh doanh của bạn.'],
  ['Đang xác minh', 'Chúng tôi kiểm tra giấy tờ và gọi vào số bạn để lại nếu cần.'],
  ['Mở lịch', 'Sân xuất hiện ở trang tìm sân, khách bắt đầu đặt được.'],
  ['Nhận đơn đầu tiên', 'Bạn nhận tin báo ngay khi có người chuyển cọc.'],
] as const;

/** Hồ sơ đang ở bước nào. 'rejected' xử lý riêng bên dưới. */
const STEP_OF: Record<string, number> = { draft: 0, pending: 1, active: 2 };

export function VenueStatusSteps({ venue }: { venue: OwnerVenue }) {
  if (venue.status === 'rejected') {
    return (
      <div className="mx-auto max-w-3xl rounded-card border border-hairline bg-card p-7 sm:p-10">
        <span className="rounded-pill bg-sunk px-3 py-1 text-xs font-semibold text-danger">Cần bổ sung thông tin</span>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-pitch">Hồ sơ chưa được duyệt</h1>
        <p className="text-[15px] leading-relaxed text-ink-secondary">
          Thường là do không liên hệ được theo số đã để lại, hoặc địa chỉ chưa rõ. Gọi cho chúng tôi để biết cần cập nhật gì và mở lại hồ sơ.
        </p>
        <Link href="/lien-he" className="mt-5 inline-flex min-h-13 items-center rounded-control bg-pitch px-7 font-semibold text-pitch-ink">
          Liên hệ
        </Link>
      </div>
    );
  }

  const current = STEP_OF[venue.status] ?? 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="rounded-card border border-hairline bg-card p-7 sm:p-10">
        <span className="inline-flex rounded-pill bg-free-fill px-3 py-1 text-[13px] font-medium text-free-ink">
          {VENUE_STATUS_LABELS[venue.status] ?? venue.status}
        </span>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-pitch sm:text-4xl">{venue.name}</h1>
        <p className="mt-2 text-[15px] text-ink-secondary">
          {venue.address} · {venue.district}{venue.phone ? ` · ${venue.phone}` : ''}
        </p>
        <div className="mt-8 border-t border-hairline pt-7">
          <p className="text-sm font-semibold text-pitch">Hồ sơ của bạn đang được xử lý</p>
          <ol className="mt-6 flex flex-col">
            {STEPS.map(([title, body], i) => {
              const done = i < current;
              const now = i === current;
              return (
                <li key={title} className="flex gap-4">
                  <div className="flex flex-none flex-col items-center">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold ${done ? 'bg-pitch text-pitch-ink' : now ? 'border-2 border-pitch bg-card text-pitch' : 'border border-hairline bg-card text-ink-secondary'}`}>
                      {done ? '✓' : i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className={`w-px flex-grow ${done ? 'bg-pitch' : 'bg-hairline'}`} />}
                  </div>
                  <div className={`flex flex-col gap-1 pb-7 ${now ? '' : 'opacity-70'}`}>
                    <span className="text-[17px] font-semibold">{title}</span>
                    <p className="text-[15px] leading-relaxed text-ink-secondary">{body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {venue.status === 'active' && <div className="flex flex-wrap gap-3 border-t border-hairline pt-7"><Link href="/chu-san" className="inline-flex min-h-13 items-center rounded-control bg-pitch px-7 font-semibold text-pitch-ink">Vào trang quản lý</Link><Link href={`/san/${venue.slug}`} className="inline-flex min-h-13 items-center rounded-control border border-hairline px-7 font-semibold">Xem trang sân</Link></div>}
      </div>
    </div>
  );
}
