'use client';

import { useState, type ReactNode } from 'react';

export function TournamentWorkspace({ participants, finance, information, pending, refunds }: {
  participants: ReactNode; finance: ReactNode; information: ReactNode; pending: number; refunds: number;
}) {
  const [active, setActive] = useState(0);
  const tabs = [
    { label: 'Người tham gia', count: pending, content: participants },
    { label: 'Thu & hoàn tiền', count: refunds, content: finance },
    { label: 'Thông tin giải', count: 0, content: information },
  ];
  return <>
    <div role="tablist" aria-label="Quản lý giải đấu" className="mb-6 flex gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map((tab, i) => <button key={tab.label} id={`tournament-tab-${i}`} role="tab" type="button" aria-selected={active === i} aria-controls={`tournament-panel-${i}`} tabIndex={active === i ? 0 : -1}
        onClick={() => setActive(i)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (i + 1) % tabs.length : event.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next !== null) { event.preventDefault(); setActive(next); document.getElementById(`tournament-tab-${next}`)?.focus(); }
        }} className={`flex min-h-13 shrink-0 items-center gap-2 border-b-2 px-3 text-sm sm:px-5 ${active === i ? 'border-pitch font-bold text-pitch' : 'border-transparent text-ink-secondary hover:text-pitch'}`}>
        {tab.label}{tab.count > 0 && <span aria-label={`${tab.count} cần xử lý`} className="rounded-full bg-peak-fill px-2 py-0.5 text-xs text-peak-ink">{tab.count}</span>}
      </button>)}
    </div>
    {tabs.map((tab, i) => <div key={tab.label} role="tabpanel" id={`tournament-panel-${i}`} aria-labelledby={`tournament-tab-${i}`} hidden={active !== i} tabIndex={0} className="space-y-6">{tab.content}</div>)}
  </>;
}

export function TournamentParticipants({ items }: { items: { id: string; search: string; state: string; content: ReactNode }[] }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi');
  const matching = items.filter(item => (filter === 'all' || item.state === filter) && normalize(item.search).includes(normalize(search.trim())));
  return <>
    <div className="my-5 flex flex-wrap items-end justify-between gap-4">
      <div role="group" aria-label="Lọc người tham gia" className="flex flex-wrap gap-2">{[['all','Tất cả'],['pending','Chờ duyệt'],['awaiting','Chờ cọc'],['ready','Đã có suất']].map(([key,label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)} className={`min-h-11 rounded-control border px-3 text-sm ${filter === key ? 'border-pitch bg-pitch font-semibold text-pitch-ink' : 'border-hairline bg-card text-ink-secondary'}`}>{label} <span className="ml-1 text-xs">{key === 'all' ? items.length : items.filter(x => x.state === key).length}</span></button>)}</div>
      <label className="flex w-full flex-col gap-1 text-xs font-semibold text-ink-secondary sm:w-64">Tìm người hoặc đội<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên, đội hoặc số điện thoại" className="min-h-11 rounded-control border border-hairline bg-card px-3 text-sm font-normal text-ink" /></label>
    </div>
    <div className="space-y-3">{matching.map(item => <div key={item.id}>{item.content}</div>)}</div>
    {!matching.length && <div role="status" className="rounded-card border border-dashed border-strong p-8 text-center text-sm leading-7 text-ink-secondary">{items.length ? 'Không có đăng ký khớp với bộ lọc. Thử đổi trạng thái hoặc tên tìm kiếm.' : 'Chưa có người đăng ký. Khi có đăng ký mới, bạn sẽ thấy tại đây.'}</div>}
  </>;
}
