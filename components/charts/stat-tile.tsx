import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

/**
 * Ô số liệu: nhãn · giá trị · thay đổi so với kỳ trước · đường xu hướng.
 *
 * Một con số kèm mốc so sánh thì đọc được; một con số trần thì không. 34 triệu
 * là nhiều hay ít chỉ biết khi đặt cạnh kỳ trước.
 */
export function StatTile({
  label, value, unit, delta, deltaLabel, spark, tone,
}: {
  label: string;
  value: string;
  unit?: string;
  /** Tỉ lệ thay đổi so với kỳ trước, ví dụ 0.12 = tăng 12%. */
  delta?: number | null;
  deltaLabel?: string;
  spark?: number[];
  tone?: 'peak';
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-card border border-hairline bg-card p-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-secondary">{label}</span>
        <span className="flex items-baseline gap-1.5">
          <strong className={`font-display text-[28px] font-extrabold leading-none tracking-tight ${tone === 'peak' ? 'text-peak-ink' : 'text-pitch'}`}>
            {value}
          </strong>
          {unit && <span className="text-sm font-medium text-ink-secondary">{unit}</span>}
        </span>
        {delta !== undefined && <Delta value={delta} label={deltaLabel} />}
      </div>
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  );
}

function Delta({ value, label }: { value: number | null | undefined; label?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="text-xs text-ink-secondary">{label ?? 'Chưa có kỳ trước để so'}</span>;
  }
  const pct = Math.round(Math.abs(value) * 100);
  const flat = pct === 0;
  const up = value > 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  // Màu trạng thái, không phải màu dữ liệu: xanh/đỏ ở đây nói tốt/xấu.
  const cls = flat ? 'text-ink-secondary' : up ? 'text-success' : 'text-danger';
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${cls}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {flat ? 'đi ngang' : `${pct}%`}
      <span className="font-normal text-ink-secondary">{label ?? 'so với kỳ trước'}</span>
    </span>
  );
}

/** Đường xu hướng trần: không trục, không nhãn — nó chỉ nói hình dáng. */
function Sparkline({ values }: { values: number[] }) {
  const w = 160;
  const h = 34;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - (v / max) * (h - 3) - 1.5] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lastX, lastY] = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="var(--color-pitch)" fillOpacity="0.1" />
      <path d={line} fill="none" stroke="var(--color-pitch)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {/* Vòng nền quanh chấm cuối để nó không lẫn vào đường khi hai thứ chồng nhau. */}
      <circle cx={lastX} cy={lastY} r="4" fill="var(--color-pitch)" stroke="var(--color-card)" strokeWidth="2" />
    </svg>
  );
}
