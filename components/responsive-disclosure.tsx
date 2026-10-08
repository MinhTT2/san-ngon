'use client';
import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export function ResponsiveDisclosure({ children, mobileOpen, count }: { children: React.ReactNode; mobileOpen: boolean; count: number }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const sync = () => { if (ref.current) ref.current.open = desktop.matches || mobileOpen; };
    sync(); desktop.addEventListener('change', sync);
    return () => desktop.removeEventListener('change', sync);
  }, [mobileOpen]);
  // Without JS every control remains available; JS only collapses on small screens.
  return <details ref={ref} open className="group/disclosure col-span-2 border-t border-hairline lg:col-span-12">
    <summary className="flex min-h-11 list-none items-center justify-between gap-3 py-3 text-sm font-semibold text-pitch lg:hidden [&::-webkit-details-marker]:hidden"><span>Bộ lọc thêm & sắp xếp{count > 0 && <span className="ml-2 rounded-pill bg-sunk px-2 py-1 text-xs">{count}</span>}</span><ChevronDown size={17} aria-hidden="true" className="group-open/disclosure:rotate-180" /></summary>
    <div className="grid gap-3 pb-1 pt-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end lg:pt-4">{children}</div>
  </details>;
}
