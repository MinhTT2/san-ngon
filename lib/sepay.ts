/** Ảnh QR VietQR do SePay sinh sẵn. Không cần thư viện QR nào. */
export function vietQrUrl(refCode: string, amount: number, bank: string, account: string) {
  const params = new URLSearchParams({
    acc: account,
    bank,
    amount: String(amount),
    des: refCode,
    template: 'compact',
  });
  return `https://qr.sepay.vn/img?${params}`;
}

/** Payload SePay gửi khi có tiền vào tài khoản. */
export type SepayPayload = {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string | null;
  code?: string | null;
  content?: string | null;
  description?: string | null;
  transferType: 'in' | 'out';
  transferAmount: number;
  referenceCode?: string;
};

/**
 * Dò mã đơn trong nội dung chuyển khoản.
 * Ngân hàng hay chèn thêm chữ, bỏ dấu, đổi hoa thường — nên quét toàn bộ nội dung.
 */
export function extractRefCode(payload: SepayPayload): string | null {
  const haystack = [payload.content, payload.description, payload.code, payload.subAccount]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
  const m = haystack.match(/SAN[A-Z0-9]{6}/);
  return m ? m[0] : null;
}

/** Website fees have their own reference, never a booking deposit reference. */
export function extractSubscriptionCodes(payload: SepayPayload): string[] {
  const text = [payload.content, payload.description, payload.code, payload.subAccount].filter(Boolean).join(' ').toUpperCase();
  const matches = [...text.matchAll(/PHI[A-F0-9]{8}(?![A-Z0-9])/g)].map(match => match[0]);
  return [...new Set(matches)];
}
