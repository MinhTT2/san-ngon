import Link from 'next/link';
import type { RealtimeResult, TrafficReport as Report, TrafficSummary } from '@/lib/ga4-report';
import { DISCOVERY_EVENTS } from '@/lib/analytics';
import { usageDuration } from '@/lib/usage-duration';

const number = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
const percent = (value: number) => `${number(value * 100)}%`;
const time = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value));
const panel = 'min-w-0 rounded-card border border-hairline bg-card p-5 lg:p-6';
const deviceNames: Record<string, string> = { desktop: 'Máy tính', mobile: 'Điện thoại', tablet: 'Máy tính bảng' };
const audienceNames: Record<string, string> = { new: 'Phiên của người mới', returning: 'Phiên của người quay lại' };
const readable = (name: string) => !name || name === '(not set)' || name === '(other)' ? 'Chưa xác định / nhóm khác' : name;

export function RealtimePanel({ result, days }: { result: RealtimeResult; days: number }) {
  return <section className={`${panel} mt-5 flex flex-wrap items-center justify-between gap-4`} aria-label="Truy cập gần đây">
    <div><h2 className="text-sm font-semibold text-pitch">Người hoạt động trong 30 phút gần nhất</h2>
      {result.status === 'ready' ? <><p className="mt-2 font-display text-3xl font-bold tabular-nums text-pitch">{number(result.users)}</p><p className="mt-2 text-xs text-ink-secondary">Lấy lúc {time(result.fetched_at)} · Cache 1 phút, tải lại để cập nhật.</p></>
        : <p className="mt-2 text-sm text-ink-secondary">{result.status === 'quota' ? 'Google đang giới hạn lượt đọc thời gian thực.' : 'Chưa đọc được báo cáo thời gian thực.'} Báo cáo theo kỳ được tải riêng.</p>}
    </div><Link href={`/admin/thong-ke-truy-cap?period=${days}`} className="inline-flex min-h-11 items-center rounded-control border border-hairline px-4 text-sm font-semibold text-pitch">Cập nhật báo cáo</Link>
  </section>;
}

function Change({ current, previous, rate }: { current: number; previous: number; rate?: boolean }) {
  const delta = rate ? (current - previous) * 100 : previous > 0 ? (current - previous) / previous * 100 : null;
  return <p className="mt-2 text-xs leading-5 text-ink-secondary">{delta === null ? current > 0 ? 'Kỳ trước chưa ghi nhận' : 'Hai kỳ chưa ghi nhận'
    : `${delta > 0 ? '+' : ''}${number(delta)} ${rate ? 'điểm %' : '%'} so với kỳ trước`}</p>;
}

export function TrafficReport({ report, days }: { report: Report; days: number }) {
  const { summary, previous } = report;
  const cards: { label: string; field: keyof TrafficSummary; format?: (value: number) => string; rate?: boolean }[] = [
    { label: 'Người dùng hoạt động', field: 'users' }, { label: 'Lượt xem trang', field: 'views' },
    { label: 'Phiên truy cập', field: 'sessions' }, { label: 'Tương tác trung bình / người', field: 'average_seconds', format: value => usageDuration(value) },
    { label: 'Người dùng mới', field: 'new_users' }, { label: 'Phiên có tương tác', field: 'engaged_sessions' },
    { label: 'Tỷ lệ tương tác', field: 'engagement_rate', format: percent, rate: true },
    { label: 'Tỷ lệ thoát', field: 'bounce_rate', format: percent, rate: true },
    { label: 'Lượt xem / phiên', field: 'views_per_session' }, { label: 'Tổng thời gian tương tác', field: 'engagement_seconds', format: value => usageDuration(value) },
  ];
  return <>
    <nav aria-label="Mục thống kê" className="mt-5 flex flex-wrap gap-x-5 gap-y-1 border-b border-hairline text-sm font-semibold text-pitch">{[
      ['tong-quan', 'Tổng quan'], ['nguon', 'Nguồn & trang'], ['nguoi-xem', 'Người xem'], ['kham-pha', 'Khám phá sân'],
    ].map(([id, title]) => <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center">{title}</a>)}</nav>
    {report.partial.length > 0 && <p role="status" className="mt-4 rounded-control border border-hairline bg-sunk p-4 text-sm leading-6">Một số bảng chưa tải được: {report.partial.join(', ')}. Các số liệu đã tải vẫn hiển thị; bảng lỗi không được tính là 0.</p>}
    {report.limited && <p className="mt-4 text-xs leading-6 text-ink-secondary">Google có áp dụng ngưỡng dữ liệu, lấy mẫu hoặc gộp nhóm trong một số bảng. Kết quả có thể chưa phản ánh đầy đủ lượt truy cập.</p>}
    <section id="tong-quan" className="scroll-mt-24 pt-6" aria-labelledby="traffic-overview"><h2 id="traffic-overview" className="font-display text-xl font-bold text-pitch">Tổng quan và thay đổi</h2>
      <p className="mt-2 text-xs leading-6 text-ink-secondary">So với {days} ngày liền trước, không chồng lặp. Kỳ hiện tại gồm hôm nay nên số liệu ngày cuối còn thay đổi; GA4 có thể cần 24–48 giờ để xử lý.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => <section key={card.field} className={panel}><h3 className="text-xs text-ink-secondary">{card.label}</h3>
        <p className="mt-3 break-words font-display text-2xl font-bold tabular-nums text-pitch">{(card.format ?? number)(summary[card.field])}</p>
        <Change current={summary[card.field]} previous={previous[card.field]} rate={card.rate} /></section>)}</div>
      <p className="mt-3 text-xs leading-6 text-ink-secondary">Phiên có tương tác: lâu hơn 10 giây, có sự kiện chính, hoặc có ít nhất 2 lượt xem (theo cấu hình GA4). Tỷ lệ thoát là tỷ lệ phiên không có tương tác. Người mới và người hoạt động dùng định nghĩa riêng của Google, không phải số tài khoản đăng ký.</p>
      <Daily report={report} />
    </section>
    <section id="nguon" className="scroll-mt-24 pt-8" aria-labelledby="traffic-sources"><h2 id="traffic-sources" className="font-display text-xl font-bold text-pitch">Nguồn và trang truy cập</h2>
      <div className="mt-4 grid items-start gap-5 lg:grid-cols-2">
        <Breakdown title="Nguồn truy cập" unit="phiên" rows={report.channels.map(row => ({ name: row.name, value: row.sessions }))} />
        <Breakdown title="Nguồn / phương tiện" unit="phiên" rows={report.sources} description="Nguồn do GA4 xác định. Website hiện không thu thập tham số chiến dịch UTM." />
        <Breakdown title="Trang được xem nhiều" unit="lượt" rows={report.pages?.map(row => ({ name: row.path, value: row.views })) ?? null} />
        <Breakdown title="Trang vào đầu tiên" unit="phiên" rows={report.landing} description="Trang công khai đầu tiên của phiên; không phải trang thoát." />
      </div>
    </section>
    <section id="nguoi-xem" className="scroll-mt-24 pt-8" aria-labelledby="traffic-audience"><h2 id="traffic-audience" className="font-display text-xl font-bold text-pitch">Người xem và thời điểm truy cập</h2>
      <p className="mt-2 text-xs leading-6 text-ink-secondary">Vị trí do Google ước tính, có thể lệch khi dùng VPN. Một người có thể xuất hiện ở nhiều nhóm; không cộng các hàng để suy ra số người duy nhất.</p>
      <div className="mt-4 grid items-start gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Breakdown title="Thiết bị" unit="người" rows={report.devices.map(row => ({ name: deviceNames[row.name] ?? readable(row.name), value: row.users }))} />
        <Breakdown title="Người mới và quay lại" unit="phiên" rows={report.audiences?.map(row => ({ ...row, name: audienceNames[row.name] ?? readable(row.name) })) ?? null} description="Phân nhóm phiên theo cookie GA4; xóa cookie hoặc đổi thiết bị có thể được tính là người mới." />
        <Breakdown title="Giờ truy cập" unit="phiên" rows={report.hours?.map(row => ({ ...row, name: `${row.name}:00–${row.name}:59` })) ?? null} description={`Cộng theo giờ trong cả kỳ, múi giờ property: ${report.time_zone || 'chưa xác định'}.`} />
        <Breakdown title="Quốc gia" unit="người" rows={report.countries} /><Breakdown title="Thành phố" unit="người" rows={report.cities} />
        <Breakdown title="Ngôn ngữ trình duyệt" unit="người" rows={report.languages} />
        <Breakdown title="Trình duyệt" unit="người" rows={report.browsers} /><Breakdown title="Hệ điều hành" unit="người" rows={report.systems} />
      </div>
    </section>
    <section id="kham-pha" className="scroll-mt-24 pt-8" aria-labelledby="traffic-discovery"><h2 id="traffic-discovery" className="font-display text-xl font-bold text-pitch">Khám phá sân</h2>
      <p className="mt-2 max-w-4xl text-sm leading-7 text-ink-secondary">Theo dõi từ lúc bản cập nhật này được triển khai. Đây là số lần thao tác độc lập, có thể lặp trong một phiên; không phải phễu theo từng người hoặc tỷ lệ đặt sân thành công. Đơn và tiền cọc xem ở <Link href="/admin" className="font-semibold text-pitch underline underline-offset-4">tổng quan vận hành</Link>.</p>
      {report.events === null ? <p className="mt-4 text-sm text-ink-secondary">Chưa tải được sự kiện khám phá sân.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-3">{Object.entries(DISCOVERY_EVENTS).map(([name, label]) => <div key={name} className={panel}><h3 className="text-sm font-semibold text-pitch">{label}</h3><p className="mt-3 font-display text-2xl font-bold tabular-nums">{number(report.events!.find(row => row.name === name)?.value ?? 0)}</p><p className="mt-2 text-xs text-ink-secondary">lần thao tác đã ghi nhận</p></div>)}</div>}
      <Recommendations report={report} />
    </section>
    <p className="mt-6 text-xs leading-6 text-ink-secondary">Báo cáo lấy lúc {time(report.fetched_at)} · Cache 10 phút · Mỗi bảng xếp hạng tối đa 20 dòng, giờ truy cập đủ 24 giờ có dữ liệu · Múi giờ: {report.time_zone || 'theo cấu hình GA4'}.</p>
  </>;
}

function Daily({ report }: { report: Report }) {
  const maximum = Math.max(1, ...report.daily.map(row => row.views));
  return <section className={`${panel} mt-5`}><h3 className="font-semibold text-pitch">Lượt xem theo ngày</h3>
    {report.daily.length ? <><div tabIndex={0} role="group" aria-label="Biểu đồ lượt xem: cuộn ngang để xem các ngày" className="mt-5 overflow-x-auto pb-2 focus-visible:outline-2 focus-visible:outline-pitch"><div style={{ minWidth: `${report.daily.length * 24}px` }}>
      <div className="flex h-40 items-end gap-1 border-b border-hairline">{report.daily.map(row => <div tabIndex={0} key={row.date} title={`${row.date.slice(6)}/${row.date.slice(4, 6)}: ${number(row.views)} lượt xem, ${number(row.users)} người hoạt động`} aria-label={`${row.date}: ${row.views} lượt xem, ${row.users} người hoạt động`} className="flex h-full min-w-0 flex-1 items-end focus-visible:outline-2 focus-visible:outline-pitch"><div className="w-full rounded-t-slot bg-pitch" style={{ height: `${row.views / maximum * 100}%` }} /></div>)}</div>
      <div aria-hidden="true" className="mt-2 flex justify-between text-[10px] text-ink-secondary">{[report.daily[0], report.daily.at(-1)].map((row, i) => <span key={i}>{row!.date.slice(6)}/{row!.date.slice(4, 6)}</span>)}</div>
    </div></div><details className="mt-3 border-t border-hairline pt-2"><summary className="cursor-pointer py-2 text-xs font-semibold text-pitch">Xem số liệu từng ngày</summary><div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs tabular-nums"><caption className="sr-only">Lượt xem và người hoạt động theo ngày</caption><thead><tr><th scope="col" className="py-3">Ngày</th><th scope="col" className="py-3 text-right">Lượt xem</th><th scope="col" className="py-3 text-right">Người hoạt động</th></tr></thead><tbody>{report.daily.map(row => <tr key={row.date} className="border-t border-hairline"><th scope="row" className="py-3 font-normal">{row.date.slice(6)}/{row.date.slice(4, 6)}/{row.date.slice(0, 4)}</th><td className="text-right">{number(row.views)}</td><td className="text-right">{number(row.users)}</td></tr>)}</tbody></table></div></details></>
      : <p className="mt-4 text-sm text-ink-secondary">Chưa có lượt xem trong kỳ.</p>}
  </section>;
}

function Breakdown({ title, unit, rows, description }: { title: string; unit: string; rows: { name: string; value: number }[] | null; description?: string }) {
  const maximum = Math.max(1, ...(rows ?? []).map(row => row.value));
  return <section className={panel}><h3 className="font-semibold text-pitch">{title}</h3>{description && <p className="mt-2 text-xs leading-6 text-ink-secondary">{description}</p>}
    <div className="mt-4 max-h-80 overflow-y-auto pr-1">{rows === null ? <p className="text-sm text-ink-secondary">Chưa tải được bảng này. Thử cập nhật báo cáo sau ít phút.</p> : rows.length ? rows.map(row => <div key={row.name} className="border-t border-hairline py-3 first:border-0"><div className="flex min-w-0 items-start justify-between gap-3 text-sm"><span className="min-w-0 break-all">{readable(row.name)}</span><span className="shrink-0 tabular-nums">{number(row.value)} {unit}</span></div><div aria-hidden="true" className="mt-2 h-1.5 bg-sunk"><div className="h-full bg-pitch" style={{ width: `${row.value / maximum * 100}%` }} /></div></div>) : <p className="text-sm text-ink-secondary">Chưa có dữ liệu trong kỳ.</p>}</div>
  </section>;
}

function Recommendations({ report }: { report: Report }) {
  const { summary, devices } = report;
  const recommendations: string[] = [];
  if (summary.sessions < 20) recommendations.push('Mẫu còn ít hơn 20 phiên. Tiếp tục thu thập trước khi kết luận về nguồn truy cập hay tỷ lệ thoát.');
  else {
    if (summary.engagement_rate < 0.3) recommendations.push('Dưới 30% phiên có tương tác: kiểm tra nguồn truy cập và trải nghiệm từ trang vào đầu tiên đến lịch sân. Đây là gợi ý kiểm tra, chưa xác định nguyên nhân.');
    const mobile = devices.find(row => row.name === 'mobile')?.users ?? 0;
    const desktop = devices.find(row => row.name === 'desktop')?.users ?? 0;
    if (mobile > desktop) recommendations.push('Nhóm điện thoại có nhiều người hoạt động hơn máy tính. Ưu tiên kiểm tra bộ lọc, chọn giờ và thao tác tiếp tục trên điện thoại thật.');
  }
  recommendations.push('Đối chiếu số lần khám phá sân với đơn và tiền cọc trong tổng quan vận hành. GA4 có thể bị chặn và không dùng để đối soát doanh thu.');
  return <aside className={`${panel} mt-5`}><h3 className="font-semibold text-pitch">Việc nên làm từ số liệu</h3><ul className="mt-3 list-disc space-y-3 pl-5 text-sm leading-7 text-ink-secondary">{recommendations.map(item => <li key={item}>{item}</li>)}</ul></aside>;
}
