import assert from 'node:assert/strict';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const key = process.env.SEPAY_WEBHOOK_API_KEY;
assert.ok(key, 'Thiếu SEPAY_WEBHOOK_API_KEY trong môi trường chạy kiểm tra.');
const endpoint = new URL('/api/webhooks/sepay', process.argv[2] ?? 'http://localhost:3000');

// Chỉ gửi payload bị bỏ qua, không chạm luồng xác nhận thanh toán.
for (const { name, auth, body, status, skipped } of [
  { name: 'Sai key', auth: 'Apikey invalid-test-key', body: '{}', status: 401 },
  { name: 'JSON lỗi', auth: `Apikey ${key}`, body: '{', status: 200, skipped: 'bad_json' },
  { name: 'Tiền ra', auth: `Apikey ${key}`, body: '{"transferType":"out"}', status: 200, skipped: 'not_incoming' },
  { name: 'Không có mã đơn', auth: `Apikey ${key}`, body: '{"transferType":"in","transferAmount":0}', status: 200, skipped: 'no_ref_code' },
]) {
  const response = await fetch(endpoint, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body });
  assert.equal(response.status, status, name);
  const json = await response.json();
  assert.equal(json.success, status === 200, `${name}: success`);
  if (skipped) assert.equal(json.skipped, skipped, name);
  console.log(`OK: ${name}`);
}
