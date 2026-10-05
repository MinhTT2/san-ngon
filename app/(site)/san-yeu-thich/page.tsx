import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FavoriteButton } from '@/components/favorite-button';
import { RefreshOnReturn } from '@/components/refresh-on-return';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sân yêu thích — Sân Ngon', robots: { index: false, follow: false } };
type Favorite = { id: string; name: string; slug: string | null; address: string | null; district: string | null; image: string | null };
export default async function Page() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/san-yeu-thich');
  const { data, error } = await db.rpc('get_my_favorites');
  if (error) throw new Error('Chưa tải được sân yêu thích.');
  const rows = (data ?? []) as Favorite[];
  return <main className="mx-auto max-w-7xl px-5 py-10 lg:px-16">
    <RefreshOnReturn />
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-display text-3xl font-extrabold text-pitch">Sân yêu thích</h1><p className="mt-3 text-sm text-ink-secondary">{rows.length} sân đã lưu · Lưu để tìm lại nhanh trên các thiết bị khi đăng nhập.</p></div><Link href="/tim-san" className="inline-flex min-h-11 items-center rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Tìm thêm sân</Link></div>
    {!rows.length ? <div className="mt-8 rounded-card border border-hairline bg-card p-10 text-center"><h2 className="font-display text-xl font-bold text-pitch">Chưa có sân yêu thích</h2><p className="mt-3 text-sm leading-6 text-ink-secondary">Mở một sân rồi chọn “Lưu sân”. Việc lưu sân không giữ chỗ; hãy xem lịch trống khi bạn muốn đặt.</p></div> : <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rows.map(row => <li key={row.id} className="overflow-hidden rounded-card border border-hairline bg-card">
      {row.image && <div className="relative h-48 bg-sunk"><Image unoptimized fill sizes="(min-width: 1024px) 33vw, 100vw" src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${row.image}`} alt={row.name} className="object-cover" /></div>}
      <div className="p-5"><h2 className="break-words font-display text-xl font-bold text-pitch">{row.name}</h2><p className="mt-2 text-sm leading-6 text-ink-secondary">{row.slug ? `${row.address} · ${row.district}` : 'Sân chưa nhận khách công khai. Bạn có thể bỏ lưu hoặc kiểm tra lại sau.'}</p><div className="mt-5 flex flex-wrap gap-3">{row.slug && <Link href={`/san/${row.slug}`} className="inline-flex min-h-11 items-center rounded-control bg-pitch px-4 py-3 text-sm font-semibold text-pitch-ink">Xem lịch sân</Link>}<FavoriteButton venueId={row.id} saved signedIn returnPath="/san-yeu-thich" /></div></div>
    </li>)}</ul>}
  </main>;
}
