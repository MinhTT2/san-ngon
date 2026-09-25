import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { secretHash } from '@/lib/sepay-crypto';
import { oauthConfig, requireSepayOwner, SEPAY_SCOPES, STATE_COOKIE, sepayErrorResponse } from '@/lib/sepay-oauth';

export async function POST(req: NextRequest) {
  try {
    const ownerId = await requireSepayOwner(req);
    const body = z.object({ return_to: z.enum(['/dang-ky-san', '/chu-san/thanh-toan']).default('/chu-san/thanh-toan') }).safeParse(await req.json().catch(() => ({})));
    if (!body.success) throw new Error('INVALID_INPUT');
    const config = oauthConfig();
    const state = randomBytes(32).toString('hex');
    const { error } = await createAdminClient().from('sepay_oauth_states').upsert({
      owner_id: ownerId, return_to: body.data.return_to, state_hash: secretHash(state), expires_at: new Date(Date.now() + 600000).toISOString(),
    }, { onConflict: 'owner_id' });
    if (error) throw new Error('DATABASE_ERROR');
    const url = new URL('https://my.sepay.vn/oauth/authorize');
    url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirect,
      scope: SEPAY_SCOPES.join(' '), state }).toString();
    const response = NextResponse.json({ url: url.href });
    response.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/sepay/callback', maxAge: 600 });
    return response;
  } catch (error) { return sepayErrorResponse(error); }
}
