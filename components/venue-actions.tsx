import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';
import { FavoriteButton } from './favorite-button';
import { ShareButton } from './share-button';

export async function VenueActions({ id, name, slug }: { id: string; name: string; slug: string }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  const favorite = user ? await db.from('venue_favorites').select('venue_id').eq('user_id', user.id).eq('venue_id', id).maybeSingle() : null;
  const path = '/san/' + encodeURIComponent(slug);
  return <div aria-label="Lưu và chia sẻ sân" className="mt-4 flex flex-wrap items-start gap-3 border-t border-hairline pt-3">
    <FavoriteButton venueId={id} signedIn={!!user} saved={favorite?.error ? null : !!favorite?.data} returnPath={path} />
    <ShareButton title={name} url={siteUrl(path).href} />
    <Link href={'/gop-y?trang=' + encodeURIComponent(path)} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-pitch underline">Báo vấn đề</Link>
  </div>;
}
