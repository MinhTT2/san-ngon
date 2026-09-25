import assert from 'node:assert/strict';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const key = process.env.SEPAY_WEBHOOK_API_KEY;
assert.ok(key, 'Thiếu SEPAY_WEBHOOK_API_KEY trong môi trường chạy kiểm tra.');
const endpoint = new URL('/api/webhooks/sepay', process.argv[2] ?? 'http://localhost:3000');
const incoming = {
  id: '999999999999999', transferType: 'in', transferAmount: 30000,
  gateway: process.env.NEXT_PUBLIC_SEPAY_BANK?.trim(),
  accountNumber: process.env.NEXT_PUBLIC_SEPAY_ACCOUNT?.trim(),
  content: 'KHONG CO MA DON',
};
assert.ok(incoming.gateway && /^\d{6,30}$/.test(incoming.accountNumber ?? '') && !/^0+$/.test(incoming.accountNumber), 'Cần cấu hình ngân hàng và tài khoản hợp lệ để kiểm tra webhook.');

// Chỉ gửi payload bị bỏ qua, không chạm luồng xác nhận thanh toán.
for (const { name, auth, body, status, skipped } of [
  { name: 'Sai key', auth: 'Apikey invalid-test-key', body: '{}', status: 401 },
  { name: 'JSON lỗi', auth: `Apikey ${key}`, body: '{', status: 200, skipped: 'bad_json' },
  { name: 'Tiền ra', auth: `Apikey ${key}`, body: '{"transferType":"out"}', status: 200, skipped: 'not_incoming' },
  { name: 'JSON null', auth: `Apikey ${key}`, body: 'null', status: 200, skipped: 'invalid_payload' },
  { name: 'JSON array', auth: `Apikey ${key}`, body: '[]', status: 200, skipped: 'invalid_payload' },
  { name: 'Thiếu thông tin', auth: `Apikey ${key}`, body: '{"transferType":"in"}', status: 200, skipped: 'invalid_payload' },
  ...[
    { name: 'Số tiền bằng 0', patch: { transferAmount: 0 } },
    { name: 'Số tiền âm', patch: { transferAmount: -1 } },
    { name: 'Số tiền lẻ', patch: { transferAmount: 29999.9 } },
    { name: 'Số tiền quá lớn', patch: { transferAmount: 2147483648 } },
    { name: 'Mã giao dịch trống', patch: { id: '' } },
    { name: 'Nội dung sai kiểu', patch: { content: {} } },
  ].map(({ name, patch }) => ({ name, auth: `Apikey ${key}`, body: JSON.stringify({ ...incoming, ...patch }), status: 200, skipped: 'invalid_payload' })),
  { name: 'Sai tài khoản', auth: `Apikey ${key}`, body: JSON.stringify({ ...incoming, accountNumber: '000000', content: 'SANZZZZZZ' }), status: 200, skipped: 'wrong_receiver' },
  { name: 'Sai ngân hàng', auth: `Apikey ${key}`, body: JSON.stringify({ ...incoming, gateway: 'wrong-test-bank', content: 'SANZZZZZZ' }), status: 200, skipped: 'wrong_receiver' },
  { name: 'Không có mã đơn', auth: `Apikey ${key}`, body: JSON.stringify(incoming), status: 200, skipped: 'no_ref_code' },
]) {
  const response = await fetch(endpoint, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body });
  assert.equal(response.status, status, name);
  const json = await response.json();
  assert.equal(json.success, status === 200, `${name}: success`);
  if (skipped) assert.equal(json.skipped, skipped, name);
  console.log(`OK: ${name}`);
}
