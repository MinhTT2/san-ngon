/**
 * Minh họa sân đêm dưới đèn cao áp. Dùng ở hero trang chủ.
 *
 * Đây là hình TẠM. Thay bằng ảnh thật của một trong các cụm sân đã onboard,
 * chụp khoảng 18h khi đèn đã bật. Ảnh thật chứng minh sân có thật — thứ mà
 * hình vẽ không làm được. Tuyệt đối không dùng ảnh stock: người Hà Nội nhận
 * ra ngay đó không phải sân phủi ở đây.
 */
export function PitchNight({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 700 430"
      role="img"
      aria-label="Minh họa sân thể thao ban đêm dưới đèn cao áp"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="700" height="430" fill="#071A12" />
      <rect y="150" width="700" height="60" fill="#0A2418" />
      <rect y="210" width="700" height="44" fill="#0D2C1E" />

      <circle cx="96" cy="58" r="3" fill="#2F6350" />
      <circle cx="612" cy="44" r="2.5" fill="#2F6350" />
      <circle cx="430" cy="72" r="2" fill="#2F6350" />
      <circle cx="248" cy="40" r="2" fill="#2F6350" />

      <polygon points="128,96 92,254 192,254" fill="#FDF3DF" opacity="0.1" />
      <polygon points="572,96 508,254 608,254" fill="#FDF3DF" opacity="0.1" />

      <rect x="124" y="96" width="8" height="158" fill="#16382B" />
      <rect x="568" y="96" width="8" height="158" fill="#16382B" />
      <rect x="104" y="72" width="48" height="26" rx="4" fill="#1F4A3A" />
      <rect x="548" y="72" width="48" height="26" rx="4" fill="#1F4A3A" />
      <rect x="110" y="78" width="16" height="14" rx="2" fill="#F4A81D" />
      <rect x="130" y="78" width="16" height="14" rx="2" fill="#F4A81D" />
      <rect x="554" y="78" width="16" height="14" rx="2" fill="#F4A81D" />
      <rect x="574" y="78" width="16" height="14" rx="2" fill="#F4A81D" />

      <polygon points="40,430 660,430 520,250 180,250" fill="#155742" />
      <polygon points="40,430 660,430 520,250 180,250" fill="#1C6A51" opacity="0.5" />

      <g stroke="#EAF5EF" strokeWidth="2" fill="none" opacity="0.55">
        <polygon points="72,416 628,416 506,260 194,260" />
        <line x1="149" y1="322" x2="551" y2="322" />
        <ellipse cx="350" cy="322" rx="66" ry="24" />
        <polygon points="266,260 434,260 452,286 248,286" />
        <polygon points="304,260 396,260 404,272 296,272" />
      </g>
      <circle cx="350" cy="322" r="3.5" fill="#EAF5EF" opacity="0.55" />
    </svg>
  );
}
