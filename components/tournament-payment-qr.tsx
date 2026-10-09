'use client';

import Image from 'next/image';
import { useState } from 'react';
import { QrImageActions } from './qr-image-actions';

export function TournamentPaymentQr({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const imageSrc = src + (attempt ? (src.includes('?') ? '&' : '?') + 'retry=' + attempt : '');
  return <div className="w-[220px] max-w-full"><div className="flex min-h-[270px] items-center justify-center rounded-control border border-hairline bg-card">
    {failed === src ? <div className="p-5 text-sm leading-6 text-ink-secondary">
      <p role="status">Không tải được mã QR. Bạn có thể chuyển khoản theo thông tin tài khoản, số tiền và nội dung bên cạnh hoặc bên dưới.</p>
      <button type="button" className="mt-3 min-h-11 font-semibold text-pitch underline" onClick={() => { setAttempt(value => value + 1); setFailed(null); }}>Tải lại mã QR</button>
    </div> : <Image unoptimized width={220} height={270} className="h-auto w-full rounded-control" src={imageSrc} alt={alt} onError={() => setFailed(src)} />}
  </div>{failed !== src && <QrImageActions src={imageSrc} filename="san-ngon-qr" />}</div>;
}
