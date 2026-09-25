// Server helpers, imported only by /api/sepay routes. Never send provider tokens to the browser.
import { randomBytes, randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSepaySecret, decryptSepaySecret, secretHash } from '@/lib/sepay-crypto';

export const SEPAY_SCOPES = ['bank-account:read', 'webhook:read', 'webhook:write'];
export const STATE_COOKIE = 'sepay_oauth_state';
const API = 'https://my.sepay.vn/api/v1';
export { ID, BankAccount } from '@/lib/sepay-provider';
const Token = z.object({
  access_token: z.string().min(1), refresh_token: z.string().min(1),
  expires_in: z.number().positive(), scope: z.string().optional(),
});
type Connection = {
  id: string; owner_id: string; status: string; bank_account_id: string | null;
  bank: string | null; account_number: string | null; account_name: string | null;
  webhook_id: string | null; webhook_key_encrypted: string | null;
  access_token_encrypted: string | null; refresh_token_encrypted: string | null;
  token_expires_at: string | null;
};

export function oauthConfig() {
  const clientId = process.env.SEPAY_OAUTH_CLIENT_ID;
  const clientSecret = process.env.SEPAY_OAUTH_CLIENT_SECRET;
  const redirect = process.env.SEPAY_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirect || !process.env.SEPAY_TOKEN_ENCRYPTION_KEY) throw new Error('SEPAY_NOT_CONFIGURED');
  const url = new URL(redirect);
  if (url.protocol !== 'https:' || url.pathname !== '/api/sepay/callback' || url.search || url.hash) throw new Error('SEPAY_NOT_CONFIGURED');
  return { clientId, clientSecret, redirect, origin: url.origin };
}

export async function requireSepayOwner(request?: NextRequest) {
  if (request && request.headers.get('origin') !== oauthConfig().origin) throw new Error('INVALID_ORIGIN');
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const { data, error } = await db.from('profiles').select('role, owner_application_status').eq('id', user.id).single();
  if (error) throw new Error('DATABASE_ERROR');
  if (!data || !(data.owner_application_status === 'pending' || (data.owner_application_status === 'active' && ['owner', 'admin'].includes(data.role)))) throw new Error('OWNER_NOT_APPROVED');
  return user.id;
}

export async function exchangeToken(params: Record<string, string>) {
  const config = oauthConfig();
  const response = await fetch('https://my.sepay.vn/oauth/token', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12000),
    body: new URLSearchParams({ ...params, client_id: config.clientId, client_secret: config.clientSecret }),
  });
  if (!response.ok) throw new Error(response.status >= 500 || response.status === 429 ? 'SEPAY_UNAVAILABLE' : 'REAUTHORIZE');
  const parsed = Token.safeParse(await response.json());
  if (!parsed.success) throw new Error('SEPAY_UNAVAILABLE');
  if (parsed.data.scope && SEPAY_SCOPES.some(s => !parsed.data.scope!.split(' ').includes(s))) throw new Error('MISSING_SCOPES');
  return parsed.data;
}

export function encryptedTokens(token: z.infer<typeof Token>, ownerId: string) {
  return {
    access_token_encrypted: encryptSepaySecret(token.access_token, ownerId),
    refresh_token_encrypted: encryptSepaySecret(token.refresh_token, ownerId),
    token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
  };
}

export async function withSepayConnection<T>(ownerId: string, action: (ctx: {
  connection: Connection; operation: string; db: ReturnType<typeof createAdminClient>;
  save: (values: Record<string, unknown>) => Promise<void>;
  api: (path: string, method?: string, body?: unknown) => Promise<unknown>;
}) => Promise<T>) {
  const db = createAdminClient();
  const operation = randomUUID();
  const { data, error } = await db.rpc('claim_sepay_connection', { p_owner_id: ownerId, p_operation: operation });
  if (error) throw new Error(error.message.includes('CONNECTION_BUSY') ? 'CONNECTION_BUSY' : 'DATABASE_ERROR');
  const connection = data as Connection;
  async function save(values: Record<string, unknown>) {
    const { error } = await db.from('sepay_connections').update(values).eq('owner_id', ownerId)
      .eq('operation_token', operation).gt('operation_expires_at', new Date().toISOString()).select('id').single();
    if (error) throw new Error('DATABASE_ERROR');
    Object.assign(connection, values);
  }
  async function refresh() {
    if (!connection.refresh_token_encrypted) throw new Error('REAUTHORIZE');
    const token = await exchangeToken({ grant_type: 'refresh_token', refresh_token: decryptSepaySecret(connection.refresh_token_encrypted, ownerId) });
    await save(encryptedTokens(token, ownerId));
  }
  async function api(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    if (!connection.access_token_encrypted) throw new Error('REAUTHORIZE');
    if (!connection.token_expires_at || Date.parse(connection.token_expires_at) < Date.now() + 30000) await refresh();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${API}${path}`, {
        method, cache: 'no-store', signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Bearer ${decryptSepaySecret(connection.access_token_encrypted!, ownerId)}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status === 401 && attempt === 0) { await refresh(); continue; }
      if (!response.ok) throw new Error(response.status === 401 ? 'REAUTHORIZE' : response.status === 403 ? 'MISSING_SCOPES' : 'SEPAY_UNAVAILABLE');
      return response.json();
    }
    throw new Error('REAUTHORIZE');
  }
  try { return await action({ connection, operation, db, save, api }); }
  catch (error) {
    if (error instanceof Error && ['REAUTHORIZE', 'MISSING_SCOPES'].includes(error.message) && connection.status !== 'disconnected') {
      await save({ status: 'reconnect' });
    }
    throw error;
  } finally {
    await db.from('sepay_connections').update({ operation_token: null, operation_expires_at: null })
      .eq('owner_id', ownerId).eq('operation_token', operation);
  }
}

export function newWebhookKey(ownerId: string) {
  const key = randomBytes(32).toString('hex');
  return { webhook_key_hash: secretHash(key), webhook_key_encrypted: encryptSepaySecret(key, ownerId) };
}

const ERRORS: Record<string, string> = {
  AUTH_REQUIRED: 'Bạn cần đăng nhập lại.', OWNER_NOT_APPROVED: 'Gửi hồ sơ đăng ký chủ sân trước khi kết nối SePay.',
  INVALID_ORIGIN: 'Mở trang Sân Ngon chính thức để kết nối SePay.', SEPAY_NOT_CONFIGURED: 'Kết nối SePay đang được thiết lập. Vui lòng thử lại sau.',
  CONNECTION_BUSY: 'Một thao tác kết nối đang chạy. Chờ ít phút rồi thử lại.',
  REAUTHORIZE: 'Vui lòng kết nối lại SePay để cấp quyền.', MISSING_SCOPES: 'SePay chưa cấp đủ quyền. Vui lòng kết nối lại và cho phép các quyền được yêu cầu.',
  SEPAY_UNAVAILABLE: 'Chưa kết nối được SePay. Bạn có thể thử lại; hệ thống sẽ kiểm tra cấu hình đã tạo.',
  BANK_INACTIVE: 'Tài khoản ngân hàng chưa hoạt động trên SePay.', BANK_CHANGE_UNSUPPORTED: 'Hiện chỉ hỗ trợ kết nối lại cùng tài khoản ngân hàng.',
  PENDING_PAYMENTS: 'Còn đơn đang chờ cọc. Chờ hết thời gian giữ chỗ hoặc xử lý các đơn trước khi ngắt kết nối.',
  DATABASE_ERROR: 'Chưa lưu được kết nối. Vui lòng thử lại.', INVALID_STATE: 'Phiên kết nối đã hết hạn hoặc không hợp lệ. Bấm kết nối lại.',
  ACCESS_DENIED: 'Bạn đã từ chối cấp quyền SePay.', INVALID_INPUT: 'Chọn tài khoản ngân hàng hợp lệ.',
};
export function sepayErrorMessage(code: string) { return ERRORS[code] ?? ERRORS.SEPAY_UNAVAILABLE; }
export function sepayErrorResponse(error: unknown) {
  const code = error instanceof Error && error.message in ERRORS ? error.message : 'SEPAY_UNAVAILABLE';
  const status = code === 'AUTH_REQUIRED' ? 401 : code === 'CONNECTION_BUSY' || code === 'PENDING_PAYMENTS' ? 409
    : code === 'OWNER_NOT_APPROVED' || code === 'INVALID_ORIGIN' ? 403 : code === 'DATABASE_ERROR' || code === 'SEPAY_UNAVAILABLE' ? 503 : 400;
  return NextResponse.json({ error: sepayErrorMessage(code), code }, { status });
}
