import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';
import Link from 'next/link';
import { FavoriteButton } from '@/components/favorite-button';
import { ShareButton } from '@/components/share-button';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: venue, error } = await supabase.from('venues')
    .select('name, address, district, images').eq('slug', slug).eq('status', 'active').maybeSingle();
  if (error) throw new Error('Không tải được thông tin sân.');
  if (!venue) return { title: 'Không tìm thấy sân — Sân Ngon', robots: { index: false, follow: false } };

  const title = `${venue.name} — Sân Ngon`;
  const description = `Đặt sân tại ${venue.name}, ${venue.address}, ${venue.district}. Xem lịch trống và chọn giờ chơi trên Sân Ngon.`;
  const url = siteUrl(`/san/${encodeURIComponent(slug)}`).href;
  const images = venue.images?.length ? [{
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${venue.images[0].split('/').map(encodeURIComponent).join('/')}`,
    alt: venue.name,
  }] : undefined;
  return {
    title, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', locale: 'vi_VN', siteName: 'Sân Ngon', images },
    twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images },
  };
}

export default async function VenueLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = await createClient();
  const { data: venue } = await db.from('venues').select('id,name').eq('slug', slug).eq('status', 'active').maybeSingle();
  if (!venue) return children;
  const { data: { user } } = await db.auth.getUser();
  const favorite = user ? await db.from('venue_favorites').select('venue_id').eq('user_id', user.id).eq('venue_id', venue.id).maybeSingle() : null;
  const path = `/san/${encodeURIComponent(slug)}`;
  return <><div className="mx-auto flex max-w-7xl flex-wrap items-start justify-end gap-3 px-5 pt-5 lg:px-16">
    <FavoriteButton venueId={venue.id} signedIn={!!user} saved={favorite?.error ? null : !!favorite?.data} returnPath={path} />
    <ShareButton title={venue.name} url={siteUrl(path).href} />
    <Link href={`/gop-y?trang=${encodeURIComponent(path)}`} className="inline-flex min-h-11 items-center px-3 py-3 text-sm font-semibold text-pitch underline">Báo vấn đề</Link>
  </div>{children}</>;
}
