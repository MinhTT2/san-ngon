import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { siteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Public anonymous access keeps drafts and owner-only data out of the sitemap.
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const entries: MetadataRoute.Sitemap = [
    '/', '/tim-san', '/giai-dau', '/ket-noi', '/lien-he', '/chinh-sach-huy',
  ].map(path => ({ url: siteUrl(path).href }));

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from('venues').select('slug')
      .eq('status', 'active').order('id').range(offset, offset + 999);
    if (error) throw new Error('Không tải được danh sách sân công khai.');
    entries.push(...data.map(venue => ({ url: siteUrl(`/san/${encodeURIComponent(venue.slug)}`).href })));
    if (data.length < 1000) break;
  }
  return entries;
}
