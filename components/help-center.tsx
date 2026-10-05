'use client';
import Link from 'next/link';
import { useState } from 'react';
import { HELP_TOPICS } from '@/lib/help';

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
export function HelpCenter() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  const topics = HELP_TOPICS.filter(topic => (!category || topic.category === category) && words.every(word => normalize(`${topic.question} ${topic.answer}`).includes(word)));
  return <>
    <div className="my-7 grid gap-4 rounded-card border border-hairline bg-card p-5 sm:grid-cols-[1fr_220px]">
      <label className="text-sm font-semibold">Tìm câu hỏi<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Ví dụ: hoàn cọc, OTP, giữ chỗ…" className="mt-2 min-h-12 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal" /></label>
      <label className="text-sm font-semibold">Chủ đề<select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 min-h-12 w-full rounded-control border border-hairline bg-page px-3 text-sm font-normal"><option value="">Tất cả chủ đề</option>{[...new Set(HELP_TOPICS.map(topic => topic.category))].map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    </div>
    <p role="status" className="mb-4 text-sm text-ink-secondary">{topics.length} câu hỏi phù hợp</p>
    <div className="space-y-3">{topics.map(topic => <details key={topic.question} className="rounded-card border border-hairline bg-card px-5 sm:px-6">
      <summary className="min-h-14 py-5 text-sm font-semibold text-pitch"><span className="mr-2 text-xs font-normal text-ink-secondary">{topic.category} ·</span>{topic.question}</summary>
      <div className="border-t border-hairline py-5"><p className="text-sm leading-7 text-ink-secondary">{topic.answer}</p><Link href={topic.href} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">{topic.link}</Link></div>
    </details>)}</div>
    {!topics.length && <div className="rounded-card border border-hairline bg-card p-7"><p className="text-sm">Chưa tìm thấy câu trả lời phù hợp. Thử từ khóa ngắn hơn hoặc gửi câu hỏi cho Sân Ngon.</p><button type="button" onClick={() => { setQuery(''); setCategory(''); }} className="mt-4 min-h-11 rounded-control border border-hairline px-5 text-sm font-semibold text-pitch">Xóa tìm kiếm</button></div>}
    <div className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-card border border-strong bg-free-fill p-6"><div><h2 className="font-display text-xl font-bold text-pitch">Vẫn cần hỗ trợ?</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">Gửi câu hỏi hoặc góp ý và theo dõi phản hồi trong tài khoản.</p></div><Link href="/gop-y" className="inline-flex min-h-11 items-center rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Gửi góp ý / báo lỗi</Link></div>
  </>;
}
