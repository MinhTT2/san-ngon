/**
 * Ba cảnh sân cho carousel hero, vẽ tay bằng SVG.
 *
 * AGENTS.md cấm ảnh stock: "người Hà Nội nhận ra ngay đó không phải sân phủi
 * ở đây". Nên đây là hình vẽ gốc, không phải ảnh giả làm ảnh thật — và mỗi
 * cảnh ứng với một môn trong dòng chữ ở hero, thay vì chỉ có bóng đá.
 *
 * Khi có ảnh thật của cụm sân đã onboard (chụp ~18h lúc đèn đã bật), thay
 * từng cảnh bằng <Image> là xong, cấu trúc carousel giữ nguyên.
 */

type SceneProps = { className?: string };

/** Sân bóng ban đêm dưới đèn cao áp. */
export function SceneFootball({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 700 430" className={className} preserveAspectRatio="xMidYMid slice" role="img"
      aria-label="Sân bóng ban đêm dưới đèn cao áp">
      <rect width="700" height="430" fill="#071A12" />
      <rect y="150" width="700" height="60" fill="#0A2418" />
      <rect y="210" width="700" height="44" fill="#0D2C1E" />
      <circle cx="96" cy="58" r="3" fill="#2F6350" />
      <circle cx="612" cy="44" r="2.5" fill="#2F6350" />
      <circle cx="430" cy="72" r="2" fill="#2F6350" />
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
      </g>
      <circle cx="350" cy="322" r="3.5" fill="#EAF5EF" opacity="0.55" />
    </svg>
  );
}

/** Sân cầu lông trong nhà, đèn tuýp trần. */
export function SceneBadminton({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 700 430" className={className} preserveAspectRatio="xMidYMid slice" role="img"
      aria-label="Sân cầu lông trong nhà">
      <defs>
        <linearGradient id="bdCeil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B2419" />
          <stop offset="100%" stopColor="#123020" />
        </linearGradient>
        <radialGradient id="bdGlow" cx="0.5" cy="0.1" r="0.75">
          <stop offset="0%" stopColor="#EAF5EF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#EAF5EF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="700" height="430" fill="#0A1F17" />
      <rect y="0" width="700" height="150" fill="url(#bdCeil)" />
      <rect width="700" height="430" fill="url(#bdGlow)" />
      {[130, 350, 570].map((x) => (
        <g key={x}>
          <rect x={x - 46} y="34" width="92" height="9" rx="4.5" fill="#1F4A3A" />
          <rect x={x - 40} y="36" width="80" height="5" rx="2.5" fill="#EAF5EF" opacity="0.55" />
          <polygon points={`${x - 46},43 ${x - 96},150 ${x + 96},150 ${x + 46},43`} fill="#EAF5EF" opacity="0.06" />
        </g>
      ))}
      <polygon points="0,430 700,430 592,150 108,150" fill="#12402F" />
      <g stroke="#EAF5EF" strokeWidth="2" fill="none" opacity="0.6">
        <polygon points="46,414 654,414 566,166 134,166" />
        <line x1="90" y1="290" x2="610" y2="290" />
        <polygon points="196,166 504,166 556,290 144,290" />
        <line x1="350" y1="166" x2="350" y2="414" />
      </g>
      {/* Lưới */}
      <g opacity="0.75">
        <line x1="90" y1="290" x2="90" y2="222" stroke="#9FC6B2" strokeWidth="3" />
        <line x1="610" y1="290" x2="610" y2="222" stroke="#9FC6B2" strokeWidth="3" />
        <rect x="90" y="222" width="520" height="52" fill="#EAF5EF" opacity="0.14" />
        <line x1="90" y1="222" x2="610" y2="222" stroke="#EAF5EF" strokeWidth="3" />
      </g>
    </svg>
  );
}

/** Sân pickleball/tennis lúc chạng vạng. */
export function ScenePickleball({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 700 430" className={className} preserveAspectRatio="xMidYMid slice" role="img"
      aria-label="Sân pickleball lúc chạng vạng">
      <defs>
        <linearGradient id="pbSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#071C16" />
          <stop offset="70%" stopColor="#0C2E22" />
          <stop offset="100%" stopColor="#12402F" />
        </linearGradient>
        <radialGradient id="pbMoon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#9FC6B2" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#9FC6B2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="700" height="430" fill="#08211A" />
      <rect y="0" width="700" height="168" fill="url(#pbSky)" />
      <circle cx="560" cy="62" r="70" fill="url(#pbMoon)" />
      <circle cx="560" cy="62" r="17" fill="#1F4A3A" />
      <circle cx="120" cy="40" r="2" fill="#2F6350" />
      <circle cx="300" cy="26" r="1.6" fill="#2F6350" />
      <circle cx="420" cy="52" r="1.8" fill="#2F6350" />
      {[64, 178, 292, 406, 520, 634].map((x) => (
        <rect key={x} x={x} y="104" width="5" height="64" rx="2.5" fill="#123A2C" />
      ))}
      <rect y="160" width="700" height="10" fill="#123A2C" />
      <rect y="104" width="700" height="4" rx="2" fill="#123A2C" opacity="0.7" />
      <polygon points="20,430 680,430 556,168 144,168" fill="#14503C" />
      <g stroke="#EAF5EF" strokeWidth="2" fill="none" opacity="0.62">
        <polygon points="58,412 642,412 546,182 154,182" />
        <line x1="112" y1="278" x2="588" y2="278" />
        <polygon points="214,182 486,182 528,278 172,278" />
        <line x1="350" y1="278" x2="350" y2="412" />
      </g>
      <g opacity="0.8">
        <line x1="112" y1="278" x2="112" y2="232" stroke="#9FC6B2" strokeWidth="3" />
        <line x1="588" y1="278" x2="588" y2="232" stroke="#9FC6B2" strokeWidth="3" />
        <rect x="112" y="232" width="476" height="40" fill="#EAF5EF" opacity="0.12" />
        <line x1="112" y1="232" x2="588" y2="232" stroke="#EAF5EF" strokeWidth="3" />
      </g>
    </svg>
  );
}
