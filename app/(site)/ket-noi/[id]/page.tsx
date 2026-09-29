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
  return <main className="mx-auto max-w-3xl px-5 py-10"><Link href="/ket-noi" className="text-sm font-semibold text-pitch">← Kết nối người chơi</Link><article className="mt-6 rounded-card border border-hairline bg-card p-7 sm:p-10"><UserAvatar name={p.display_name} avatar={p.avatar_url} className="size-24 text-4xl" /><h1 className="mt-5 font-display text-3xl font-extrabold text-pitch">{p.display_name}</h1><p className="mt-3 text-sm text-ink-secondary">{p.location}</p><p className="mt-3 font-semibold text-pitch">{SPORT_LABELS[p.sport]} · {skillLabels[p.skill_level]}</p><p className="mt-5 whitespace-pre-wrap text-sm leading-7">{p.bio}</p><h2 className="mt-7 font-display text-xl font-bold">Thông tin liên hệ</h2><div className="mt-4 flex flex-wrap gap-3"><a className="rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink" href={`tel:${p.phone}`}>{p.phone}</a>{p.zalo_phone && <a className="rounded-control border border-hairline px-5 py-3 text-sm font-semibold text-pitch" target="_blank" rel="noopener noreferrer" href={`https://zalo.me/${p.zalo_phone}`}>Zalo ↗</a>}{p.facebook_url && <a className="rounded-control border border-hairline px-5 py-3 text-sm font-semibold text-pitch" target="_blank" rel="noopener noreferrer" href={p.facebook_url}>Facebook ↗</a>}</div></article></main>;
}
