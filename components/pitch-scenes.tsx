/**
 * Ba cảnh sân cho carousel hero, vẽ tay bằng SVG.
 *
 * Đây là hình minh họa gốc thay cho ảnh stock. Mỗi cảnh có bảng màu riêng để
 * carousel tạo cảm giác như ba buổi chơi khác nhau, thay vì ba nền xanh giống
 * nhau.
 */

type SceneProps = { className?: string };

/** Sân bóng lúc hoàng hôn, đèn sân vừa bật. */
export function SceneFootball({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 700 430" className={className} preserveAspectRatio="xMidYMid slice" role="img"
      aria-label="Sân bóng lúc hoàng hôn dưới đèn cao áp">
      <defs>
        <linearGradient id="footballSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#30205F" />
          <stop offset="48%" stopColor="#D93D83" />
          <stop offset="100%" stopColor="#FF8A4C" />
        </linearGradient>
        <linearGradient id="footballGrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1B9A68" />
          <stop offset="100%" stopColor="#064B3C" />
        </linearGradient>
        <radialGradient id="footballSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FFE6A3" />
          <stop offset="100%" stopColor="#FFB23E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="footballGlow" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFF4D6" stopOpacity="0.25" />
          <stop offset="1" stopColor="#FFF4D6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="700" height="430" fill="url(#footballSky)" />
      <circle cx="350" cy="158" r="105" fill="url(#footballSun)" />
      <circle cx="350" cy="158" r="34" fill="#FFD47A" opacity="0.92" />
      <path d="M0 196h700v62H0z" fill="#241B42" opacity="0.66" />
      <path d="M0 222 90 188l74 34 96-38 105 38 96-34 139 34v42H0Z" fill="#171A35" opacity="0.7" />
      <polygon points="0,430 700,430 538,244 162,244" fill="url(#footballGrass)" />
      <polygon points="0,430 700,430 538,244 162,244" fill="#5CE09A" opacity="0.12" />
      <path d="m162 244 376 0" stroke="#D8FFF0" strokeWidth="3" opacity="0.85" />
      <g stroke="#EAF5EF" strokeWidth="2.5" fill="none" opacity="0.84">
        <polygon points="52,416 648,416 526,258 174,258" />
        <line x1="116" y1="334" x2="584" y2="334" />
        <ellipse cx="350" cy="334" rx="67" ry="25" />
        <polygon points="262,258 438,258 456,286 244,286" />
      </g>
      <g>
        <path d="M96 83 71 254M604 83 629 254" stroke="#252346" strokeWidth="8" />
        <path d="M96 83 71 254M604 83 629 254" stroke="#FFCF70" strokeWidth="2" opacity="0.7" />
        <rect x="68" y="68" width="56" height="24" rx="6" fill="#35295D" />
        <rect x="576" y="68" width="56" height="24" rx="6" fill="#35295D" />
        <rect x="76" y="74" width="16" height="11" rx="2" fill="#FFE19A" />
        <rect x="97" y="74" width="16" height="11" rx="2" fill="#FFE19A" />
        <rect x="584" y="74" width="16" height="11" rx="2" fill="#FFE19A" />
        <rect x="605" y="74" width="16" height="11" rx="2" fill="#FFE19A" />
        <path d="M76 92 146 252H246L112 92ZM624 92 554 252H454L588 92Z" fill="url(#footballGlow)" />
      </g>
      <circle cx="493" cy="369" r="9" fill="#FFF8E8" opacity="0.96" />
      <path d="m493 360 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill="#30205F" opacity="0.72" />
    </svg>
  );
}

/** Sân cầu lông trong nhà với đèn màu và mặt sân coral. */
export function SceneBadminton({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 700 430" className={className} preserveAspectRatio="xMidYMid slice" role="img"
      aria-label="Sân cầu lông trong nhà với đèn màu">
      <defs>
        <linearGradient id="badmintonCeiling" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#121A4A" />
          <stop offset="1" stopColor="#6C265E" />
        </linearGradient>
        <linearGradient id="badmintonCourt" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#F06D62" />
          <stop offset="1" stopColor="#D83964" />
        </linearGradient>
        <radialGradient id="badmintonLight" cx="0.5" cy="0.1" r="0.8">
          <stop stopColor="#86F4FF" stopOpacity="0.36" />
          <stop offset="1" stopColor="#86F4FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="700" height="430" fill="#10163C" />
      <rect width="700" height="175" fill="url(#badmintonCeiling)" />
      <rect width="700" height="430" fill="url(#badmintonLight)" />
      <path d="M0 175h700v255H0z" fill="#211D4A" />
      <g opacity="0.95">
        <rect x="92" y="30" width="142" height="12" rx="6" fill="#75F4FF" />
        <rect x="279" y="30" width="142" height="12" rx="6" fill="#FFD166" />
        <rect x="466" y="30" width="142" height="12" rx="6" fill="#FF6F91" />
        <path d="M92 42 42 176h242L234 42ZM279 42l-50 134h242L421 42ZM466 42l-50 134h242L608 42Z" fill="#A5F7FF" opacity="0.08" />
      </g>
      <polygon points="0,430 700,430 579,176 121,176" fill="url(#badmintonCourt)" />
      <polygon points="0,430 700,430 579,176 121,176" fill="#FFBE6B" opacity="0.12" />
      <g stroke="#FFF4E8" strokeWidth="2.5" fill="none" opacity="0.88">
        <polygon points="45,414 655,414 568,190 132,190" />
        <line x1="84" y1="302" x2="616" y2="302" />
        <polygon points="188,190 512,190 555,302 145,302" />
        <line x1="350" y1="190" x2="350" y2="414" />
      </g>
      <g opacity="0.9">
        <line x1="84" y1="302" x2="84" y2="236" stroke="#A5F7FF" strokeWidth="4" />
        <line x1="616" y1="302" x2="616" y2="236" stroke="#A5F7FF" strokeWidth="4" />
        <rect x="84" y="236" width="532" height="48" fill="#B9FBFF" opacity="0.16" />
        <line x1="84" y1="236" x2="616" y2="236" stroke="#F4FFFF" strokeWidth="3" />
        <path d="m560 125 13 20 14-20-14-20Z" fill="#FFF4E8" />
        <path d="m560 125 14 0 13 20-20-8Z" fill="#75F4FF" opacity="0.75" />
      </g>
    </svg>
  );
}

/** Sân pickleball trên sân thượng lúc chạng vạng. */
export function ScenePickleball({ className = '' }: SceneProps) {
  return (
    <svg viewBox="0 0 700 430" className={className} preserveAspectRatio="xMidYMid slice" role="img"
      aria-label="Sân pickleball lúc chạng vạng với đèn dây màu">
      <defs>
        <linearGradient id="pickleballSky" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#24205D" />
          <stop offset="0.53" stopColor="#E65783" />
          <stop offset="1" stopColor="#FFB34D" />
        </linearGradient>
        <linearGradient id="pickleballCourt" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#19B8B2" />
          <stop offset="1" stopColor="#087D83" />
        </linearGradient>
        <radialGradient id="pickleballSun" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#FFE6A3" />
          <stop offset="1" stopColor="#FFB34D" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="700" height="430" fill="url(#pickleballSky)" />
      <circle cx="525" cy="160" r="92" fill="url(#pickleballSun)" />
      <circle cx="525" cy="160" r="30" fill="#FFE09A" opacity="0.95" />
      <path d="M0 220 90 182l67 30 86-49 80 44 97-58 78 50 91-28 121 49v70H0Z" fill="#262052" opacity="0.8" />
      <path d="M0 268h700v162H0z" fill="#171B3A" />
      <polygon points="10,430 690,430 549,194 151,194" fill="url(#pickleballCourt)" />
      <polygon points="10,430 690,430 549,194 151,194" fill="#FFCC66" opacity="0.16" />
      <g stroke="#EFFFFA" strokeWidth="2.5" fill="none" opacity="0.9">
        <polygon points="53,413 647,413 539,210 161,210" />
        <line x1="104" y1="307" x2="596" y2="307" />
        <polygon points="213,210 487,210 530,307 170,307" />
        <line x1="350" y1="307" x2="350" y2="413" />
      </g>
      <g>
        <line x1="104" y1="307" x2="104" y2="247" stroke="#FFCF70" strokeWidth="4" />
        <line x1="596" y1="307" x2="596" y2="247" stroke="#FFCF70" strokeWidth="4" />
        <rect x="104" y="247" width="492" height="45" fill="#F8FFFF" opacity="0.16" />
        <line x1="104" y1="247" x2="596" y2="247" stroke="#F8FFFF" strokeWidth="3" />
      </g>
      <g stroke="#FFCF70" strokeWidth="3" strokeLinecap="round">
        <path d="M90 82C220 30 420 28 612 82" fill="none" opacity="0.7" />
        <circle cx="137" cy="70" r="6" fill="#FF6F91" stroke="none" />
        <circle cx="213" cy="52" r="6" fill="#75F4FF" stroke="none" />
        <circle cx="296" cy="43" r="6" fill="#FFD166" stroke="none" />
        <circle cx="393" cy="44" r="6" fill="#FF6F91" stroke="none" />
        <circle cx="491" cy="56" r="6" fill="#75F4FF" stroke="none" />
        <circle cx="575" cy="73" r="6" fill="#FFD166" stroke="none" />
      </g>
    </svg>
  );
}
