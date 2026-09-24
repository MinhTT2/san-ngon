/** Hình mặt sân vẽ bằng SVG. Dùng thay ảnh cho tới khi có ảnh thật của chủ sân. */
export function PitchThumb({
  width = 84,
  height = 66,
  src,
  alt = '',
}: {
  width?: number | string;
  height?: number;
  src?: string;
  alt?: string;
}) {
  if (src) return <div role={alt ? 'img' : undefined} aria-label={alt || undefined} style={{ width, height, backgroundImage: `url(${src})` }} className="flex-none bg-cover bg-center bg-sunk" />;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 84 66"
      fill="none"
      preserveAspectRatio="none"
      className="flex-none"
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="83" height="65" className="fill-free-fill stroke-strong" />
      <g className="stroke-free-line" fill="none">
        <line x1="42" y1="7" x2="42" y2="59" />
        <circle cx="42" cy="33" r="9" />
        <rect x="6" y="21" width="12" height="24" />
        <rect x="66" y="21" width="12" height="24" />
      </g>
    </svg>
  );
}
