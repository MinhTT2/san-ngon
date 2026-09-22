'use client';

import { useState } from 'react';

/**
 * Xem giấy phép kinh doanh ngay trong trang.
 *
 * Nghiệp vụ duyệt là đối chiếu giấy tờ với thông tin đã khai, nên bắt admin mở
 * tab mới rồi bấm qua bấm lại là sai chỗ nhất. Ảnh nhúng bằng <img>, PDF bằng
 * <iframe> — hai loại tệp duy nhất register_owner() nhận.
 *
 * Link ký của Supabase Storage có hạn 5 phút. Mở trang rồi để đó nửa tiếng thì
 * ảnh gãy, nên vẫn giữ một đường mở lại ở tab mới (route tự ký link mới) thay vì
 * một ô trắng không giải thích gì.
 */
export function LicensePreview({ src, path, fallbackHref }: { src: string; path: string; fallbackHref: string }) {
  const [failed, setFailed] = useState(false);
  const isPdf = path.toLowerCase().endsWith('.pdf');

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <p className="text-sm text-ink-secondary">
          Không hiện được giấy tờ ngay tại đây. Mở ở tab mới để xem bản gốc.
        </p>
        <a href={fallbackHref} target="_blank" rel="noreferrer"
          className="flex h-11 items-center rounded-control bg-pitch px-5 text-sm font-semibold text-pitch-ink">
          Mở giấy tờ ↗
        </a>
      </div>
    );
  }

  return (
    <div className="bg-sunk">
      {isPdf ? (
        <iframe src={src} title="Giấy phép kinh doanh" onError={() => setFailed(true)}
          className="h-[34rem] w-full border-0" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- ảnh nằm sau link ký có hạn, không đi qua trình tối ưu ảnh được
        <img src={src} alt="Giấy phép kinh doanh" onError={() => setFailed(true)}
          className="max-h-[34rem] w-full bg-card object-contain" />
      )}
    </div>
  );
}
