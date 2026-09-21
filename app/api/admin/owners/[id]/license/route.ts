import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (me?.role !== 'admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const { id } = await params;
  const { data: profile } = await supabase.from('profiles').select('business_license_path').eq('id', id).maybeSingle();
  if (!profile?.business_license_path) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  const { data, error } = await supabase.storage.from('venue-documents').createSignedUrl(profile.business_license_path, 300);
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
