import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';

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

export default function VenueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
