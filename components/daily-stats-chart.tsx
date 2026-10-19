import { BarChart3 } from 'lucide-react';
import { vnd } from '@/lib/format';

export function DailyStatsChart({ title, description, points, money = false }: {
  title: string;
  description: string;
  points: { date: string; value: number }[];
  money?: boolean;
}) {
  const peak = Math.max(0, ...points.map(point => point.value));
  const scale = Math.max(peak, 1);
  const valueLabel = (value: number) => money ? vnd(value) : `${value} đơn`;
  const dateLabel = (date: string) => date.split('-').reverse().join('/');
  const shortDate = (date: string) => date.slice(5).split('-').reverse().join('/');
  return <section data-motion-item aria-label={title} className="min-w-0 rounded-card border border-hairline bg-card p-5 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><BarChart3 className="size-4 shrink-0 text-pitch" aria-hidden="true" /><h3 className="font-semibold">{title}</h3></div><p className="mt-1 text-xs leading-5 text-ink-secondary">{description}</p></div>
      {peak > 0 && <span className="rounded-pill bg-free-fill px-2.5 py-1 text-xs font-semibold text-free-ink">Đỉnh {valueLabel(peak)}</span>}
    </div>
    {peak === 0 && <p className="mt-4 text-sm text-ink-secondary">{money ? 'Chưa có tiền đặt sân được xác nhận trong kỳ.' : 'Chưa có đơn đã xác nhận hoặc hoàn tất trong kỳ.'}</p>}
    <div className="mt-6 flex gap-2">
      <div aria-hidden="true" className="flex h-36 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-ink-secondary">
        <span>{money ? vnd(peak) : peak}</span><span>{money ? vnd(peak / 2) : Math.floor(peak / 2)}</span><span>0</span>
      </div>
      <div dir="rtl" tabIndex={0} role="group" aria-label={`${title}: cuộn ngang để xem các ngày`} className="min-w-0 flex-1 overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-pitch">
        <div dir="ltr" style={{ minWidth: `${points.length * 16}px` }}>
          <div className="pf-chart-plot flex h-36 items-end gap-1 border-b border-hairline">
            {points.map((point, index) => <div key={point.date} tabIndex={0} aria-label={`${dateLabel(point.date)}: ${valueLabel(point.value)}`} title={`${dateLabel(point.date)}: ${valueLabel(point.value)}`} className="group relative flex h-full min-w-0 flex-1 items-end justify-center focus-visible:outline-2 focus-visible:outline-pitch">
              <div aria-hidden="true" className="pf-chart-bar w-full max-w-8 rounded-t-slot bg-pitch transition-opacity group-hover:opacity-70 group-focus:opacity-70" style={{ ['--pf-chart-delay' as string]: `${Math.min(index, 12) * 25}ms`, height: `${point.value / scale * 100}%` }} />
            </div>)}
          </div>
          <div aria-hidden="true" className="mt-2 flex justify-between gap-1 text-[10px] tabular-nums text-ink-secondary">
            {[...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].filter(index => points[index]).map(index => <span key={index}>{shortDate(points[index].date)}</span>)}
          </div>
        </div>
      </div>
    </div>
    {points.length > 14 && <p className="mt-2 text-[10px] text-ink-secondary">Cuộn ngang để xem các ngày trước · Mở bảng bên dưới để xem đầy đủ.</p>}
    <details className="mt-4 border-t border-hairline pt-2">
      <summary className="cursor-pointer py-2 text-xs font-semibold text-pitch">Xem số liệu từng ngày</summary>
      <div className="mt-2 max-h-64 overflow-auto"><table className="w-full text-left text-xs tabular-nums"><caption className="sr-only">{title}</caption><thead><tr className="border-b border-hairline"><th scope="col" className="py-2">Ngày</th><th scope="col" className="py-2 text-right">{money ? 'Tiền đã nhận' : 'Số đơn'}</th></tr></thead><tbody>{points.map(point => <tr key={point.date} className="border-b border-hairline last:border-0"><th scope="row" className="py-2 font-normal">{dateLabel(point.date)}</th><td className="py-2 text-right">{valueLabel(point.value)}</td></tr>)}</tbody></table></div>
    </details>
  </section>;
}
