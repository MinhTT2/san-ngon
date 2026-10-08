'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { enterMotion } from '@/lib/motion';
import { ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export type DashboardRecord = { id: string; search: string; status: string; cells: ReactNode[] };
/** Read-only display filters. The server supplies every record and action. */
export function DashboardRecords({ title, description, columns, records, statuses = [], mobilePrimary = [] }: {
  title: string; description: string; columns: string[]; records: DashboardRecord[];
  statuses?: { value: string; label: string }[]; mobilePrimary?: number[];
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const term = query.trim().toLocaleLowerCase('vi');
  const matches = records.filter(row => (!status || row.status === status) && (!term || row.search.toLocaleLowerCase('vi').includes(term)));
  const pages = Math.max(1, Math.ceil(matches.length / 20));
  const current = Math.min(page, pages);
  const rows = matches.slice((current - 1) * 20, current * 20);
  const resultsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (resultsRef.current) return enterMotion(resultsRef.current, 0, 6);
  }, [current, status]);
  return <section aria-label={title} className="pf-records mt-6 min-w-0 overflow-hidden rounded-card border border-hairline bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline p-4 sm:p-5"><div><h2 className="font-display text-xl font-bold text-pitch">{title}</h2><p className="mt-1 text-xs leading-6 text-ink-secondary">{description}</p></div><span className="rounded-pill bg-sunk px-3 py-1.5 text-xs font-semibold text-pitch">{matches.length} kết quả</span></div>
    <div className="flex flex-wrap gap-3 border-b border-hairline p-4 sm:px-5">
      <label className="relative min-w-0 flex-[1_1_220px]"><span className="sr-only">Tìm trong {title.toLowerCase()}</span><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-ink-secondary" aria-hidden="true" /><input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm theo tên, số điện thoại, mã…" className="h-11 w-full rounded-control border border-hairline bg-page pl-10 pr-3 text-sm" /></label>
      {!!statuses.length && <label className="min-w-0 flex-[0_1_200px]"><span className="sr-only">Lọc {title.toLowerCase()} theo trạng thái</span><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="h-11 w-full rounded-control border border-hairline bg-page px-3 text-sm"><option value="">Tất cả trạng thái</option>{statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>}
      {(query || status) && <button type="button" onClick={() => { setQuery(''); setStatus(''); setPage(1); }} className="pf-action min-h-11 px-3 text-xs font-semibold text-pitch underline underline-offset-4">Xóa bộ lọc</button>}
    </div>
    <div ref={resultsRef}>
    {!rows.length ? <div role="status" className="px-5 py-12 text-center"><Search size={28} className="mx-auto text-ink-secondary" aria-hidden="true" /><p className="mt-3 font-semibold text-pitch">{records.length ? 'Không có kết quả phù hợp' : 'Danh sách hiện đang trống'}</p><p className="mt-2 text-xs leading-6 text-ink-secondary">{records.length ? 'Thử từ khóa khác hoặc bỏ bớt bộ lọc.' : 'Các hồ sơ mới sẽ xuất hiện tại đây.'}</p></div> : <>
      <div className="hidden overflow-x-auto lg:block"><table className="w-full text-sm"><thead className="bg-page"><tr className="border-b border-hairline text-left text-[11px] text-ink-secondary">{columns.map(col => <th key={col} scope="col" className="px-4 py-3 font-semibold">{col}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-hairline align-top transition-colors last:border-0 hover:bg-page">{row.cells.map((cell, i) => <td key={i} className="max-w-xs break-words px-4 py-4">{cell}</td>)}</tr>)}</tbody></table></div>
      <ul className="divide-y divide-hairline lg:hidden">{rows.map(row => <li key={row.id} className="p-4 sm:p-5"><div className="break-words font-semibold text-pitch">{row.cells[0]}</div>
        <dl className="mt-3 flex flex-wrap items-start gap-x-5 gap-y-3">{mobilePrimary.map(i => <div key={i} className="min-w-0"><dt className={columns[i] === 'Thao tác' || columns[i] === 'Trạng thái' || columns[i] === 'Tình trạng phí' ? 'sr-only' : 'mb-1 text-[11px] text-ink-secondary'}>{columns[i]}</dt><dd className="break-words text-sm">{row.cells[i]}</dd></div>)}</dl>
        {row.cells.some((_, i) => i > 0 && !mobilePrimary.includes(i)) && <details className="group mt-3 border-t border-hairline"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-pitch [&::-webkit-details-marker]:hidden">Thông tin chi tiết<ChevronDown size={15} aria-hidden="true" className="group-open:rotate-180" /></summary><dl className="grid gap-3 pb-2 sm:grid-cols-2">{row.cells.map((cell, i) => i > 0 && !mobilePrimary.includes(i) ? <div key={i} className="min-w-0"><dt className="mb-1.5 text-[11px] text-ink-secondary">{columns[i]}</dt><dd className="break-words text-sm">{cell}</dd></div> : null)}</dl></details>}
      </li>)}</ul>
    </>}
    </div>
    <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3 text-xs text-ink-secondary"><span>{matches.length ? `${(current - 1) * 20 + 1}–${Math.min(current * 20, matches.length)} / ${matches.length}` : '0 kết quả'}</span><nav aria-label={`Phân trang ${title.toLowerCase()}`} className="flex items-center gap-2"><button type="button" aria-label="Trang trước" disabled={current <= 1} onClick={() => setPage(current - 1)} className="pf-action grid size-11 place-items-center rounded-control border border-hairline disabled:opacity-40"><ChevronLeft size={16} aria-hidden="true" /></button><span>{current} / {pages}</span><button type="button" aria-label="Trang sau" disabled={current >= pages} onClick={() => setPage(current + 1)} className="pf-action grid size-11 place-items-center rounded-control border border-hairline disabled:opacity-40"><ChevronRight size={16} aria-hidden="true" /></button></nav></div>
  </section>;
}
