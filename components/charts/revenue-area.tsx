import { vnd } from '@/lib/format';

export type RevenuePoint = { ngay: string; doanh_thu: number; so_don: number };

/**
 * Doanh thu cọc theo ngày.
 *
 * Một chuỗi duy nhất nên không cần chú giải — tiêu đề đã nói đang vẽ gì. Chỉ
 * ghi nhãn hai điểm: ngày cao nhất và ngày cuối; ghi số lên mọi điểm thì thành
 * rác và không ai đọc. Phần còn lại nằm ở trục và ở tooltip từng ngày.
 *
 * Vẽ hẳn ở server: không thư viện biểu đồ, không JavaScript, tooltip là <title>
 * của SVG nên vẫn chạy khi JS chưa tải xong.
 */
export function RevenueArea({ data, height = 210 }: { data: RevenuePoint[]; height?: number }) {
  if (data.length < 2) {
    return (
      <p className="p-10 text-center text-sm text-ink-secondary">
        Chưa đủ dữ liệu để vẽ biểu đồ. Cần ít nhất hai ngày có đơn đã thanh toán.
      </p>
    );
  }

  const w = 720;
  const padL = 8;
  const padR = 8;
  const padT = 16;
  const padB = 22;
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;

  const values = data.map((d) => d.doanh_thu);
  const rawMax = Math.max(...values);
  // Trục làm tròn lên mốc chẵn để nhãn đọc được, không phải 3.417.000đ.
  const step = niceStep(rawMax);
  const max = Math.max(step, Math.ceil(rawMax / step) * step);
  const ticks = [0, max / 2, max];

  const x = (i: number) => padL + (i / (data.length - 1)) * innerW;
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.doanh_thu).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${padT + innerH} L${padL},${padT + innerH} Z`;

  const peakIndex = values.indexOf(rawMax);
  const lastIndex = data.length - 1;
  const band = innerW / data.length;

  return (
    <figure className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img"
        aria-label={`Doanh thu cọc ${data.length} ngày gần nhất, cao nhất ${vnd(rawMax)} ngày ${dm(data[peakIndex].ngay)}`}>
        {/* Lưới nhạt hơn dữ liệu một bậc, nét liền, không đứt quãng. */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--color-hairline)" strokeWidth="1" />
            <text x={padL} y={y(t) - 5} className="fill-[var(--color-ink-secondary)] text-[11px]">
              {t === 0 ? '0' : `${Math.round(t / 1_000_000)}tr`}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--color-pitch)" fillOpacity="0.1" />
        <path d={line} fill="none" stroke="var(--color-pitch)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dải trong suốt phủ từng ngày: vùng bắt hover rộng hơn hẳn cái chấm. */}
        {data.map((d, i) => (
          <rect key={d.ngay} x={x(i) - band / 2} y={padT} width={band} height={innerH} fill="transparent"
            className="hover:fill-[var(--color-sunk)] hover:opacity-60">
            <title>{`${dm(d.ngay)} · ${vnd(d.doanh_thu)} · ${d.so_don} đơn`}</title>
          </rect>
        ))}

        {[peakIndex, lastIndex].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
          <circle key={i} cx={x(i)} cy={y(data[i].doanh_thu)} r="4.5"
            fill="var(--color-pitch)" stroke="var(--color-card)" strokeWidth="2" />
        ))}

        <text x={clamp(x(peakIndex), 30, w - 60)} y={Math.max(y(rawMax) - 12, 12)}
          textAnchor="middle" className="fill-[var(--color-ink)] text-[12px] font-semibold">
          {vnd(rawMax)}
        </text>

        <text x={padL} y={height - 5} className="fill-[var(--color-ink-secondary)] text-[11px]">{dm(data[0].ngay)}</text>
        <text x={w - padR} y={height - 5} textAnchor="end" className="fill-[var(--color-ink-secondary)] text-[11px]">
          {dm(data[lastIndex].ngay)}
        </text>
      </svg>
      <figcaption className="text-xs leading-relaxed text-ink-secondary">
        Tiền cọc đã về tài khoản, theo ngày. Phần khách trả tay tại sân không nằm trong đây.
      </figcaption>
    </figure>
  );
}

function niceStep(max: number) {
  if (max <= 0) return 1_000_000;
  const raw = max / 2;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** "2026-09-18" → "18/09" */
function dm(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
