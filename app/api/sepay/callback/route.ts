import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { secretHash } from '@/lib/sepay-crypto';
import { encryptedTokens, exchangeToken, oauthConfig, requireSepayOwner, STATE_COOKIE, withSepayConnection } from '@/lib/sepay-oauth';

export async function GET(req: NextRequest) {
  const target = new URL('/chu-san/thanh-toan', req.url);
  try {
    target.host = new URL(oauthConfig().origin).host;
    target.protocol = 'https:';
    const ownerId = await requireSepayOwner();
    const state = req.nextUrl.searchParams.get('state');
    if (!state || !/^[a-f0-9]{64}$/.test(state) || req.cookies.get(STATE_COOKIE)?.value !== state) throw new Error('INVALID_STATE');
    const { data, error } = await createAdminClient().from('sepay_oauth_states').delete()
      .eq('owner_id', ownerId).eq('state_hash', secretHash(state)).gt('expires_at', new Date().toISOString()).select('owner_id').maybeSingle();
    if (error) throw new Error('DATABASE_ERROR');
    if (!data) throw new Error('INVALID_STATE');
    if (req.nextUrl.searchParams.has('error')) throw new Error('ACCESS_DENIED');
    const code = req.nextUrl.searchParams.get('code');
    if (!code || code.length > 4096) throw new Error('INVALID_STATE');
    await withSepayConnection(ownerId, async ({ save }) => {
      const token = await exchangeToken({ grant_type: 'authorization_code', code, redirect_uri: oauthConfig().redirect });
      await save(encryptedTokens(token, ownerId));
    });
    target.searchParams.set('connected', '1');
  } catch (error) {
    const code = error instanceof Error ? error.message : 'SEPAY_UNAVAILABLE';
    const allowed = ['AUTH_REQUIRED', 'OWNER_NOT_APPROVED', 'INVALID_STATE', 'ACCESS_DENIED', 'DATABASE_ERROR', 'MISSING_SCOPES', 'REAUTHORIZE', 'CONNECTION_BUSY'];
    target.searchParams.set('error', allowed.includes(code) ? code : 'SEPAY_UNAVAILABLE');
  }
  const response = NextResponse.redirect(target);
  response.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/sepay/callback', maxAge: 0 });
  return response;
}
