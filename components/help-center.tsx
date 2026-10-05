'use client';
import Link from 'next/link';
import { useRef } from 'react';
import { HELP_TOPICS } from '@/lib/help';
import { useQueryControls } from '@/lib/use-query-controls';
import { matchesSearch } from '@/lib/text-search';

export function HelpCenter() {
  const { params, update } = useQueryControls();
  const input = useRef<HTMLInputElement>(null);
  const query = (params.get('q') ?? '').slice(0, 100);
  const requestedCategory = params.get('chu-de') ?? '';
  const categories = [...new Set(HELP_TOPICS.map(topic => topic.category))];
  const category = categories.includes(requestedCategory) ? requestedCategory : '';
  const topics = HELP_TOPICS.filter(topic => (!category || topic.category === category) && matchesSearch(`${topic.question} ${topic.answer}`, query));
  const clear = () => { update({ q: null, 'chu-de': null }); input.current?.focus(); };
  return <>
    <div className="my-7 grid gap-4 rounded-card border border-hairline bg-card p-5 sm:grid-cols-[1fr_220px]">
      <div><label htmlFor="help-search" className="text-sm font-semibold">Tìm câu hỏi</label><input ref={input} id="help-search" type="search" value={query} maxLength={100} onChange={event => update({ q: event.target.value })} placeholder="Ví dụ: hoàn cọc, OTP, giữ chỗ…" className="mt-2 min-h-12 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal" /></div>
      <div><label htmlFor="help-category" className="text-sm font-semibold">Chủ đề</label><select id="help-category" value={category} onChange={event => update({ 'chu-de': event.target.value }, true)} className="mt-2 min-h-12 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal"><option value="">Tất cả chủ đề</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
    </div>
    <div className="mb-4 flex items-center justify-between gap-4"><p role="status" className="text-sm text-ink-secondary">{topics.length} câu hỏi phù hợp</p>{(query || category) && <button type="button" onClick={clear} className="min-h-11 text-sm font-semibold text-pitch underline">Xóa tìm kiếm</button>}</div>
    <div className="space-y-3">{topics.map(topic => <details key={topic.question} className="rounded-card border border-hairline bg-card px-5 sm:px-6">
      <summary className="min-h-14 py-5 text-sm font-semibold text-pitch"><span className="mr-2 text-xs font-normal text-ink-secondary">{topic.category} ·</span>{topic.question}</summary>
      <div className="border-t border-hairline py-5"><p className="text-sm leading-7 text-ink-secondary">{topic.answer}</p><Link href={topic.href} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">{topic.link}</Link></div>
    </details>)}</div>
    {!topics.length && <div className="rounded-card border border-hairline bg-card p-7"><p className="text-sm">Chưa tìm thấy câu trả lời phù hợp. Thử từ khóa ngắn hơn hoặc gửi câu hỏi cho Sân Ngon.</p></div>}
    <div className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-card border border-strong bg-free-fill p-6"><div><h2 className="font-display text-xl font-bold text-pitch">Vẫn cần hỗ trợ?</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">Gửi câu hỏi hoặc góp ý và theo dõi phản hồi trong tài khoản.</p></div><Link href="/gop-y" className="inline-flex min-h-11 items-center rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Gửi góp ý / báo lỗi</Link></div>
  </>;
}
