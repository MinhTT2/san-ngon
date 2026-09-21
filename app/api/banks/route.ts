import { NextResponse } from 'next/server';

type Bank = { code: string; name: string; shortName: string };

const FALLBACK_BANKS: Bank[] = [
  { code: 'VCB', name: 'Ngân hàng TMCP Ngoại thương Việt Nam', shortName: 'Vietcombank' },
  { code: 'CTG', name: 'Ngân hàng TMCP Công thương Việt Nam', shortName: 'VietinBank' },
  { code: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam', shortName: 'BIDV' },
  { code: 'TCB', name: 'Ngân hàng TMCP Kỹ thương Việt Nam', shortName: 'Techcombank' },
  { code: 'MB', name: 'Ngân hàng TMCP Quân đội', shortName: 'MBBank' },
  { code: 'ACB', name: 'Ngân hàng TMCP Á Châu', shortName: 'ACB' },
  { code: 'VPB', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng', shortName: 'VPBank' },
  { code: 'TPB', name: 'Ngân hàng TMCP Tiên Phong', shortName: 'TPBank' },
  { code: 'STB', name: 'Ngân hàng TMCP Sài Gòn Thương Tín', shortName: 'Sacombank' },
  { code: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam', shortName: 'VIB' },
];

export async function GET() {
  try {
    const response = await fetch('https://api.vietqr.io/v2/banks', { next: { revalidate: 86400 } });
    if (!response.ok) throw new Error('BANKS_FETCH_FAILED');
    const json = await response.json() as { data?: Array<{ code?: string; name?: string; shortName?: string; short_name?: string; transferSupported?: number }> };
    const banks = (json.data ?? [])
      .filter((bank) => bank.code && bank.name && bank.transferSupported !== 0)
      .map((bank) => ({ code: bank.code!, name: bank.name!, shortName: bank.shortName ?? bank.short_name ?? bank.name! }))
      .sort((a, b) => a.shortName.localeCompare(b.shortName, 'vi'));
    if (banks.length) return NextResponse.json({ banks });
  } catch {
    // Dùng danh sách dự phòng để form không bị khóa khi VietQR tạm lỗi.
  }
  return NextResponse.json({ banks: FALLBACK_BANKS });
}
