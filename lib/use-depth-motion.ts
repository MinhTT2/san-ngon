'use client';

import { useEffect } from 'react';

/** One delegated listener for streamed cards; no React renders on pointer movement. */
export function useDepthMotion(route: string) {
  useEffect(() => {
    const capable = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    let surface: HTMLElement | null = null;
    let frame = 0;
    let x = 0;
    let y = 0;

    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!surface) return;
      surface.style.removeProperty('--pf-depth-x');
      surface.style.removeProperty('--pf-depth-y');
      surface.removeAttribute('data-depth-active');
      surface = null;
    };
    const move = (event: PointerEvent) => {
      if (!capable.matches || event.pointerType !== 'mouse') { reset(); return; }
      const next = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-depth]') : null;
      if (next !== surface) reset();
      if (!next) return;
      surface = next;
      const rect = next.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (!surface) return;
        surface.style.setProperty('--pf-depth-x', String(x));
        surface.style.setProperty('--pf-depth-y', String(y));
        surface.dataset.depthActive = 'true';
      });
    };
    const visibility = () => { if (document.hidden) reset(); };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', reset);
    document.addEventListener('pointercancel', reset);
    document.addEventListener('scroll', reset, { passive: true, capture: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', reset);
    capable.addEventListener('change', reset);
    return () => {
      reset();
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', reset);
      document.removeEventListener('pointercancel', reset);
      document.removeEventListener('scroll', reset, true);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', reset);
      capable.removeEventListener('change', reset);
    };
  }, [route]);
}
