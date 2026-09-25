import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { CreatedWebhook, Webhook, WEBHOOK_RETRY_CONDITIONS } from '@/lib/sepay-provider';
import { decryptSepaySecret } from '@/lib/sepay-crypto';
import { BankAccount, ID, newWebhookKey, oauthConfig, requireSepayOwner, sepayErrorResponse, withSepayConnection } from '@/lib/sepay-oauth';


export async function POST(req: NextRequest) {
  try {
    const ownerId = await requireSepayOwner(req);
    const body = z.object({ account_id: ID }).safeParse(await req.json().catch(() => null));
    if (!body.success) throw new Error('INVALID_INPUT');
    await withSepayConnection(ownerId, async ({ connection: c, operation, db, api, save }) => {
      const bank = z.object({ data: BankAccount }).parse(await api(`/bank-accounts/${body.data.account_id}`)).data;
      if (!bank.active) throw new Error('BANK_INACTIVE');
      if (c.bank_account_id && (c.bank_account_id !== bank.id || c.bank !== bank.bank.short_name || c.account_number !== bank.account_number)) throw new Error('BANK_CHANGE_UNSUPPORTED');
      await save({ bank_account_id: bank.id, bank: bank.bank.short_name, account_number: bank.account_number, account_name: bank.account_holder_name,
        ...(!c.webhook_key_encrypted ? newWebhookKey(ownerId) : {}) });
      const key = decryptSepaySecret(c.webhook_key_encrypted!, ownerId);
      const url = `${oauthConfig().origin}/api/webhooks/sepay?connection=${c.id}`;
      if (!c.webhook_id) {
        // A timed-out create may have succeeded. Reuse only our exact URL and secret.
        for (let page = 1; page <= 20; page++) {
          const list = z.object({ data: z.array(Webhook), meta: z.object({ pagination: z.object({ last_page: z.number().max(20) }) }).optional() })
            .parse(await api(`/webhooks?webhook_url=${encodeURIComponent(url)}&limit=100&page=${page}`));
          const match = list.data.find(w => w.webhook_url === url && w.bank_account_id === bank.id && w.api_key === key);
          if (match) { await save({ webhook_id: match.id }); break; }
          if (page >= (list.meta?.pagination.last_page ?? 1)) break;
        }
      }
      const config = { bank_account_id: Number(bank.id), name: 'Sân Ngon — nhận cọc', event_type: 'In_only', authen_type: 'Api_Key',
        webhook_url: url, is_verify_payment: 1, skip_if_no_code: 0, only_va: 0, active: 1,
        api_key: key, request_content_type: 'Json', retry_conditions: WEBHOOK_RETRY_CONDITIONS };
      if (c.webhook_id) await api(`/webhooks/${c.webhook_id}`, 'PATCH', config);
      else {
        const created = CreatedWebhook.parse(await api('/webhooks', 'POST', config));
        await save({ webhook_id: created.id });
      }
      const verified = z.object({ data: Webhook }).parse(await api(`/webhooks/${c.webhook_id}`)).data;
      if (!verified.active || verified.webhook_url !== url || verified.bank_account_id !== bank.id
        || verified.authen_type !== 'Api_Key' || verified.event_type !== 'In_only' || verified.api_key !== key) throw new Error('SEPAY_UNAVAILABLE');
      const { error } = await db.rpc('activate_sepay_connection', { p_owner_id: ownerId, p_operation: operation });
      if (error) throw new Error('DATABASE_ERROR');
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return sepayErrorResponse(error); }
}

export async function DELETE(req: NextRequest) {
  try {
    const ownerId = await requireSepayOwner(req);
    await withSepayConnection(ownerId, async ({ connection, operation, db, api, save }) => {
      const { error } = await db.rpc('disconnect_sepay_connection', { p_owner_id: ownerId, p_operation: operation });
      if (error) throw new Error(error.message.includes('PENDING_PAYMENTS') ? 'PENDING_PAYMENTS' : error.message.includes('SUBSCRIPTION_RECEIVER_IN_USE') ? 'SUBSCRIPTION_RECEIVER_IN_USE' : 'DATABASE_ERROR');
      connection.status = 'disconnected';
      if (connection.webhook_id) await api(`/webhooks/${connection.webhook_id}`, 'PATCH', { active: 0 });
      await save({ access_token_encrypted: null, refresh_token_encrypted: null, token_expires_at: null });
    });
    return NextResponse.json({ ok: true });
  } catch (error) { return sepayErrorResponse(error); }
}
