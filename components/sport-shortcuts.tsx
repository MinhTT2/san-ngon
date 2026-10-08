import Link from 'next/link';
import { SPORT_LABELS } from '@/lib/constants';
import { SportGlyph } from './sport-glyph';
import { NavigationMarker } from './navigation-marker';

/** Các lối tắt lọc bằng URL: giữ ngày/khu vực, quay lại trang kết quả đầu tiên. */
export function SportShortcuts({ pathname, sport, params = {} }: {
  pathname: string; sport?: string; params?: Record<string, string | undefined>;
}) {
  const href = (value: string) => {
    const query = new URLSearchParams(Object.entries(params).filter(([key, value]) => key !== 'page' && key !== 'sport' && !!value) as [string, string][]);
    if (value) query.set('sport', value);
    return `${pathname}${query.size ? `?${query}` : ''}`;
  };
  return <nav aria-label="Chọn nhanh môn chơi" className="pf-selection-rail relative isolate flex min-w-0 gap-2 overflow-x-auto py-1">
    <NavigationMarker activeKey={`${pathname}:${sport || ''}`} />
    {[['', 'Tất cả môn'], ...Object.entries(SPORT_LABELS)].map(([key, label]) => <Link key={key} href={href(key)} scroll={false} aria-current={(sport || '') === key ? 'true' : undefined}
      className={`pf-selection-link pf-action relative z-10 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-3.5 text-xs font-semibold sm:text-sm ${(sport || '') === key ? 'border-pitch bg-pitch text-pitch-ink' : 'border-hairline bg-card text-ink-secondary hover:border-strong hover:text-pitch'}`}>
      <SportGlyph sport={key} className="size-[18px] shrink-0" />{label.replace(' người', '')}
    </Link>)}
  </nav>;
}
