'use client';

import { useEffect, useRef } from 'react';
import { playMotion } from '@/lib/motion';

/** One selection surface glides between items, including the mobile scroll rail. */
export function NavigationMarker({ activeKey, variant = 'surface' }: { activeKey: string; variant?: 'surface' | 'underline' }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const marker = ref.current;
    const nav = marker?.parentElement;
    if (!marker || !nav) return;
    let dispose = () => {};
    const position = (animate = false) => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"], [aria-pressed="true"]');
      if (!active) { delete nav.dataset.markerReady; return; }
      const item = active.getBoundingClientRect(), host = nav.getBoundingClientRect();
      const height = variant === 'underline' ? 2 : item.height;
      const destination = `${item.left - host.left + nav.scrollLeft - nav.clientLeft}px ${item.top - host.top + nav.scrollTop - nav.clientTop + (variant === 'underline' ? item.height - 2 : 0)}px`;
      if (nav.dataset.markerReady && marker.style.translate === destination && marker.style.width === `${item.width}px` && marker.style.height === `${height}px`) return;
      const previous = getComputedStyle(marker);
      const from = { translate: previous.translate, width: previous.width, height: previous.height };
      dispose();
      marker.style.width = `${item.width}px`; marker.style.height = `${height}px`;
      marker.style.translate = destination;
      if (animate && nav.dataset.markerReady) {
        dispose = playMotion(marker, { translate: [from.translate, marker.style.translate], width: [from.width, marker.style.width], height: [from.height, marker.style.height] }, { duration: 0.38 });
      }
      nav.dataset.markerReady = 'true';
    };
    position(true);
    const resize = () => position();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(nav);
    const active = nav.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"], [aria-pressed="true"]');
    if (active) observer?.observe(active);
    window.addEventListener('resize', resize);
    return () => { dispose(); observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [activeKey, variant]);
  return <span ref={ref} data-variant={variant} aria-hidden="true" className="pf-nav-marker pointer-events-none absolute left-0 top-0 rounded-control bg-pitch" />;
}
