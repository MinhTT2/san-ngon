'use client';

import Image from 'next/image';
import { useState } from 'react';

export function TournamentPaymentQr({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <div className="flex min-h-[270px] w-[220px] max-w-full items-center justify-center rounded-control border border-hairline bg-card">
    {failed === src ? <div className="p-5 text-sm leading-6 text-ink-secondary">
      <p role="status">Không tải được mã QR. Bạn có thể chuyển khoản theo thông tin tài khoản, số tiền và nội dung bên cạnh hoặc bên dưới.</p>
      <button type="button" className="mt-3 min-h-11 font-semibold text-pitch underline" onClick={() => setFailed(null)}>Tải lại mã QR</button>
    </div> : <Image unoptimized width={220} height={270} className="h-auto w-full rounded-control" src={src} alt={alt} onError={() => setFailed(src)} />}
  </div>;
}
