/**
 * Màn chờ: vòng tròn xoay quanh mark Sân Ngon, nền mờ.
 *
 * Độ mờ làm bằng backdrop-blur cộng hai quầng sáng blur-3xl — không phải đổ
 * bóng, nên không phạm quy tắc "không đổ bóng ở đâu cả" trong AGENTS.md.
 */
import { BrandMark } from './brand-mark';

export function BrandLoader({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pf-fade fixed inset-0 z-50 grid place-items-center overflow-hidden bg-page/70 backdrop-blur-xl"
    >
      {/* Hai quầng màu mờ phía sau, lấy từ token giờ trống và giờ vàng. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-[70%] -translate-y-1/2 rounded-full bg-free-fill blur-3xl" />
        <span className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-[10%] -translate-y-[35%] rounded-full bg-peak-fill blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-5">
        <div className="relative grid h-20 w-20 place-items-center">
          <Ring />
          <BrandMark size={34} />
        </div>
        <span className="font-display text-[15px] font-bold tracking-tight text-pitch">{label}</span>
      </div>
    </div>
  );
}

/** Cung tròn chạy vòng quanh. Mark đứng yên để còn đọc được. */
function Ring() {
  return (
    <svg
      viewBox="0 0 80 80"
      className="pf-spin absolute inset-0 h-20 w-20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="36" className="stroke-strong" strokeWidth="3" />
      <path
        d="M40 4a36 36 0 0 1 36 36"
        className="stroke-pitch"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
