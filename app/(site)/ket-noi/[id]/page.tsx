export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SPORT_LABELS } from '@/lib/constants';
import { skillLabels, type CommunityProfile } from '@/lib/community';
import { UserAvatar } from '@/components/user-avatar';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!z.string().uuid().safeParse(id).success) notFound();
  const db = await createClient(); const { data, error } = await db.rpc('get_community_profile',{ p_id: id });
  if (error) throw new Error('Chưa tải được hồ sơ.'); if (!data) notFound(); const p = data as CommunityProfile;
  return <main className="mx-auto max-w-5xl px-5 py-10 lg:py-14"><Link href="/ket-noi" className="inline-flex min-h-11 items-center text-sm font-semibold text-pitch">← Kết nối người chơi</Link>
    {!p.is_public && <p className="mt-4 rounded-control border border-strong bg-sunk p-4 text-sm text-ink-secondary">Bản xem trước riêng tư. Chỉ bạn thấy hồ sơ này. <Link href="/ket-noi/ho-so" className="font-semibold text-pitch underline">Chỉnh sửa hồ sơ</Link></p>}
    <article className="mt-6 overflow-hidden rounded-[24px] border border-strong bg-card"><header className="flex flex-col gap-5 border-b border-strong bg-free-fill p-7 sm:flex-row sm:items-center sm:gap-7 sm:p-10"><UserAvatar name={p.display_name} avatar={p.avatar_url} className="size-24 shrink-0 text-4xl" /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-ink-secondary">Gặp nhau trên sân</p><h1 className="mt-3 break-words font-display text-3xl font-extrabold tracking-tight text-pitch sm:text-4xl">{p.display_name}</h1><p className="mt-3 break-words text-sm text-ink-secondary">{p.location}</p></div></header>
      <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_280px]"><section className="min-w-0"><h2 className="font-display text-xl font-bold text-pitch">Môn chơi & trình độ</h2><div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-free-fill px-4 py-2 font-semibold text-pitch">{SPORT_LABELS[p.sport]}</span><span className="rounded-full border border-hairline px-4 py-2 text-ink-secondary">{skillLabels[p.skill_level]}</span></div><h2 className="mt-8 font-display text-xl font-bold text-pitch">Một chút về tôi</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-ink-secondary">{p.bio || 'Chưa có lời giới thiệu. Bạn có thể liên hệ để hỏi lịch chơi và làm quen.'}</p></section>
        <aside className="rounded-card border border-hairline bg-page p-5"><h2 className="font-display text-xl font-bold text-pitch">Bắt đầu bằng lời chào</h2><p className="mt-3 text-sm leading-7 text-ink-secondary">Giới thiệu môn chơi và khung giờ bạn thường rảnh để dễ hẹn một buổi trên sân.</p><div className="mt-5 flex flex-col gap-3"><a className="flex min-h-12 items-center justify-center rounded-control bg-pitch px-4 py-3 text-sm font-semibold text-pitch-ink" href={`tel:${p.phone}`}>{p.phone}</a>{p.zalo_phone && <a className="flex min-h-11 items-center justify-between rounded-control border border-strong px-4 py-3 text-sm font-semibold text-pitch" target="_blank" rel="noopener noreferrer" href={`https://zalo.me/${p.zalo_phone}`}>Liên hệ qua Zalo <span aria-hidden="true">↗</span></a>}{p.facebook_url && <a className="flex min-h-11 items-center justify-between rounded-control border border-strong px-4 py-3 text-sm font-semibold text-pitch" target="_blank" rel="noopener noreferrer" href={p.facebook_url}>Facebook <span aria-hidden="true">↗</span></a>}</div><p className="mt-4 text-xs leading-6 text-ink-secondary">Thông tin do người chơi tự chia sẻ. Liên hệ trực tiếp để thống nhất lịch chơi.</p></aside>
      </div>
    </article>
  </main>;
}
