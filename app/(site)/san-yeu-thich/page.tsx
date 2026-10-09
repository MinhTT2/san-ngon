import { VenueCardPhoto } from '@/components/venue-card-photo';
import { MapPin, Heart } from 'lucide-react';
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
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 id="saved-venues-heading" tabIndex={-1} className="focus:outline-2 focus:outline-offset-4 focus:outline-pitch font-display text-3xl font-extrabold text-pitch">Sân yêu thích</h1><p role="status" className="mt-3 text-sm text-ink-secondary">{rows.length} sân đã lưu · Lưu để tìm lại nhanh trên các thiết bị khi đăng nhập.</p></div><Link href="/tim-san" className="inline-flex min-h-11 items-center rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">Tìm thêm sân</Link></div>
    {!rows.length ? <div className="mt-8 rounded-card border border-hairline bg-card p-10 text-center"><h2 className="font-display text-xl font-bold text-pitch">Chưa có sân yêu thích</h2><p className="mt-3 text-sm leading-6 text-ink-secondary">Mở một sân rồi chọn “Lưu sân”. Việc lưu sân không giữ chỗ; hãy xem lịch trống khi bạn muốn đặt.</p></div> : <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{rows.map(row => <li key={row.id} className="pf-card group flex min-w-0 flex-col overflow-hidden rounded-card border border-hairline bg-card">
      <VenueCardPhoto name={row.name} src={row.image ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${row.image}` : undefined} />
      <div className="flex flex-1 flex-col p-5"><p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-ink-secondary"><Heart size={13} aria-hidden="true" />{row.slug ? 'Sân đã lưu' : 'Chưa nhận khách công khai'}</p><h2 className="break-words font-display text-xl font-bold text-pitch">{row.name}</h2><p className="mb-5 mt-2 flex items-start gap-1.5 text-sm leading-6 text-ink-secondary">{row.slug && <MapPin size={14} className="mt-1 shrink-0" aria-hidden="true" />}<span>{row.slug ? [row.address, row.district].filter(Boolean).join(' · ') : 'Sân chưa nhận khách công khai. Bạn có thể bỏ lưu hoặc kiểm tra lại sau.'}</span></p><div className="mt-auto flex flex-wrap gap-3">{row.slug && <Link href={`/san/${row.slug}?from=${encodeURIComponent('/san-yeu-thich')}`} className="inline-flex min-h-11 items-center rounded-control bg-pitch px-4 py-3 text-sm font-semibold text-pitch-ink">Xem lịch sân</Link>}<FavoriteButton venueId={row.id} venueName={row.name} saved signedIn returnPath="/san-yeu-thich" /></div></div>
    </li>)}</ul>}
  </main>;
}
