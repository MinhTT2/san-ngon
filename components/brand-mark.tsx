/**
 * Mark Sân Ngon: mặt sân nhìn nghiêng dưới đèn cao áp — cùng góc nhìn với
 * ảnh hero, để logo và trang chủ kể một câu chuyện.
 *
 * Bản cũ vẽ sân từ trên xuống bằng nét 1.2px: ở 20px (favicon) các nét dính
 * vào nhau thành một vệt. Hình thang ít chi tiết hơn nên co nhỏ vẫn đọc được.
 *
 * Không dùng vàng hổ phách. AGENTS.md giữ màu đó riêng cho giờ vàng và trạng
 * thái chờ — đưa vào logo là làm loãng tín hiệu.
 */
export function BrandMark({ size = 30, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect width="30" height="30" rx="8.5" fill="#0F3D2E" />
      <g stroke="#9FC6B2" strokeWidth="1.15" fill="none" strokeLinejoin="round">
        <path d="M4 23.5 L9.6 8.2 L20.4 8.2 L26 23.5 Z" />
        <path d="M6.9 15.85 L23.1 15.85" />
        <ellipse cx="15" cy="15.85" rx="3.5" ry="2.1" />
      </g>
    </svg>
  );
}
