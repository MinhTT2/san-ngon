'use client';

import { useEffect, useRef } from 'react';

/** One selection surface glides between items, including the mobile scroll rail. */
export function NavigationMarker({ activeKey }: { activeKey: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const marker = ref.current;
    const nav = marker?.parentElement;
    if (!marker || !nav) return;
    const position = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) { delete nav.dataset.markerReady; return; }
      const item = active.getBoundingClientRect(), host = nav.getBoundingClientRect();
      marker.style.width = `${item.width}px`; marker.style.height = `${item.height}px`;
      marker.style.translate = `${item.left - host.left + nav.scrollLeft}px ${item.top - host.top + nav.scrollTop}px`;
      nav.dataset.markerReady = 'true';
    };
    position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position);
    observer?.observe(nav);
    window.addEventListener('resize', position);
    return () => { observer?.disconnect(); window.removeEventListener('resize', position); };
  }, [activeKey]);
  return <span ref={ref} aria-hidden="true" className="pf-nav-marker pointer-events-none absolute left-0 top-0 rounded-control bg-pitch" />;
}
