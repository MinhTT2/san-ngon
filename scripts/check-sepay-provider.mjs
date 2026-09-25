import assert from 'node:assert/strict';
import { CreatedWebhook, Webhook } from '../lib/sepay-provider.ts';

// Sanitized shapes captured from the live OAuth API and its documented older response.
assert.equal(CreatedWebhook.parse({ status: 'success', data: { id: 59325 } }).id, '59325');
assert.equal(CreatedWebhook.parse({ message: 'Created', id: '59325' }).id, '59325');
for (const result of [{ data: {} }, { data: { id: 0 } }, { id: '../another-webhook' }, { data: { id: Number.MAX_SAFE_INTEGER + 1 } }]) {
  assert.equal(CreatedWebhook.safeParse(result).success, false);
}
const webhook = Webhook.parse({ id: 59325, bank_account_id: 85993, webhook_url: 'https://example.com/webhook', active: true, authen_type: 'Api_Key', event_type: 'In_only', api_key: 'fixture-key', request_content_type: 'Json', retry_conditions: { non_2xx_status_code: 1 } });
assert.equal(webhook.id, '59325');
assert.equal(webhook.bank_account_id, '85993');
console.log('OK: live/documented webhook responses parse; invalid IDs are rejected.');
