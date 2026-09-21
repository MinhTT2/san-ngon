import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  const { id } = await params;
  const { data: venue, error } = await supabase.from('venues').select('business_license_path').eq('id', id).maybeSingle();
  if (error || !venue?.business_license_path) return NextResponse.json({ error: 'LICENSE_NOT_FOUND' }, { status: 404 });

  const { data: signed, error: signedError } = await supabase.storage
    .from('venue-documents').createSignedUrl(venue.business_license_path, 300);
  if (signedError || !signed?.signedUrl) return NextResponse.json({ error: 'LICENSE_UNAVAILABLE' }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
