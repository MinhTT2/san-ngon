export type OccupancyCell = { thu: number; gio: number; so_don: number; so_luot: number; ty_le: number };

const DAY_ROWS = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<number, string> = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' };
const DAY_FULL: Record<number, string> = {
  0: 'Chủ nhật', 1: 'Thứ hai', 2: 'Thứ ba', 3: 'Thứ tư', 4: 'Thứ năm', 5: 'Thứ sáu', 6: 'Thứ bảy',
};

/**
 * Lưới lấp đầy theo giờ × thứ.
 *
 * Đây là biểu đồ đúng nghề nhất của một sân bóng: nó trả lời thẳng câu chủ sân
 * hỏi mỗi tuần — khung nào đang ế mà giảm giá, khung nào kín mà nâng giá.
 *
 * Thang độ lớn nên dùng một sắc nhạt→đậm (--color-scale-*), không phải cầu vồng.
 * Ô không ghi số: ghi số vào 126 ô thì không ai đọc, con số nằm ở tooltip và ở
 * ô nóng nhất được ghi nhãn riêng.
 */
export function OccupancyHeatmap({ data, subtitle }: { data: OccupancyCell[]; subtitle?: string }) {
  if (data.length === 0) {
    return <p className="p-10 text-center text-sm text-ink-secondary">Chưa có đơn nào trong kỳ để dựng lưới.</p>;
  }

  const hours = [...new Set(data.map((d) => d.gio))].sort((a, b) => a - b);
  const byKey = new Map(data.map((d) => [`${d.thu}:${d.gio}`, d]));
  const hottest = data.reduce((a, b) => (b.ty_le > a.ty_le ? b : a));

  return (
    <figure className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        {/* Không w-full: 18 cột kéo giãn theo bề ngang màn hình thì ô to như
            viên gạch. Ô rộng cố định, bảng tự co, tràn thì cuộn ngang. */}
        <table className="min-w-[720px] border-separate border-spacing-[2px]">
          <caption className="sr-only">
            Tỉ lệ lấp đầy theo giờ và thứ. Ô càng đậm càng kín chỗ.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-9" />
              {hours.map((h) => (
                <th key={h} scope="col" className="pb-1 text-center text-[10px] font-medium tabular-nums text-ink-secondary">
                  {h % 2 === 0 ? String(h).padStart(2, '0') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_ROWS.map((thu) => (
              <tr key={thu}>
                <th scope="row" className="pr-2 text-right text-[11px] font-medium text-ink-secondary">
                  {DAY_LABEL[thu]}
                </th>
                {hours.map((gio) => {
                  const cell = byKey.get(`${thu}:${gio}`);
                  const rate = cell?.ty_le ?? 0;
                  const isHottest = cell && cell.thu === hottest.thu && cell.gio === hottest.gio;
                  return (
                    <td key={gio} className="p-0">
                      <div
                        title={cell
                          ? `${DAY_FULL[thu]} ${String(gio).padStart(2, '0')}:00 — lấp đầy ${Math.round(rate * 100)}% (${cell.so_don}/${cell.so_luot} lượt)`
                          : `${DAY_FULL[thu]} ${String(gio).padStart(2, '0')}:00 — ngoài giờ mở cửa`}
                        className={`h-8 w-10 rounded-slot ${cell ? '' : 'border border-dashed border-hairline'} ${
                          isHottest ? 'outline outline-2 outline-offset-1 outline-pitch' : ''
                        }`}
                        style={cell ? { background: `var(--color-scale-${bucket(rate)})` } : undefined}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <figcaption className="max-w-lg text-xs leading-relaxed text-ink-secondary">
          {subtitle ?? 'Ô càng đậm càng kín chỗ.'} Khung kín nhất:{' '}
          <strong className="font-semibold text-ink">
            {DAY_FULL[hottest.thu].toLowerCase()} {String(hottest.gio).padStart(2, '0')}:00
          </strong>{' '}
          — lấp đầy {Math.round(hottest.ty_le * 100)}%.
        </figcaption>

        <div className="flex items-center gap-2 text-[11px] text-ink-secondary">
          <span>Ế</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="size-4 rounded-[3px]" style={{ background: `var(--color-scale-${i})` }} />
          ))}
          <span>Kín</span>
        </div>
      </div>
    </figure>
  );
}

/** 0–1 → bậc 0–5 của dải chuỗi. */
function bucket(rate: number) {
  if (rate <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil(rate * 5)));
}
