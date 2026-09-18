import { BrandMark } from './brand-mark';

export function BrandLoader({ label = 'Đang mở sân gần bạn…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pf-fade fixed inset-0 z-50 grid place-items-center overflow-hidden bg-pitch text-white"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60">
        <span className="absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-story-teal/20 blur-3xl" />
        <span className="absolute -right-16 bottom-1/4 h-72 w-72 rounded-full bg-story-coral/20 blur-3xl" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 800" preserveAspectRatio="none" fill="none">
          <path d="M-80 640 210 180h780l290 460" stroke="currentColor" strokeOpacity=".12" strokeWidth="2" />
          <path d="M80 800 300 330h600l220 470M0 520h1200M360 330l90 470M840 330l-90 470" stroke="currentColor" strokeOpacity=".1" strokeWidth="2" />
          <circle cx="600" cy="510" r="94" stroke="currentColor" strokeOpacity=".12" strokeWidth="2" />
        </svg>
      </div>

      <div className="relative flex w-[min(20rem,calc(100vw-2.5rem))] flex-col items-center rounded-[28px] border border-white/15 bg-white/[0.06] px-8 py-9 text-center">
        <div className="relative grid h-28 w-28 place-items-center">
          <span className="pf-loader-orbit absolute inset-0 rounded-full border border-free-line/30 border-t-story-coral" />
          <span className="absolute inset-3 rounded-full border border-white/10" />
          <span className="pf-loader-pulse absolute h-3 w-3 rounded-full bg-story-coral" />
          <BrandMark size={54} />
        </div>
        <p className="mt-7 font-display text-xl font-extrabold tracking-[-0.02em]">Sân Ngon</p>
        <p className="mt-2 text-sm text-free-line">{label}</p>
        <div className="mt-7 h-1 w-full overflow-hidden rounded-pill bg-white/10" aria-hidden="true">
          <span className="pf-loader-progress block h-full w-1/3 rounded-pill bg-gradient-to-r from-free-line via-story-teal to-story-coral" />
        </div>
        <span className="mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Xem lịch · Chọn sân · Lên kèo</span>
      </div>
    </div>
  );
}
