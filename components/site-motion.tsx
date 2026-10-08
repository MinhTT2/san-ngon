'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const ITEMS = 'main > header, main h1, main > form, main > section > h2, [data-motion-item], .pf-card';
const SKIP = '.pf-reveal, .pf-in, .profile-enter, .checkout, dialog, [role="dialog"], [data-motion-skip]';

/** Enhance existing pages without remounting forms or hiding server-rendered content. */
export function SiteMotion() {
  const pathname = usePathname();
  const params = useSearchParams();
  const route = `${pathname}?${params.toString()}`;
  const [pending, setPending] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPending(false);
    if (timeout.current) clearTimeout(timeout.current);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | null = null;
    let frame = 0;
    const items = new Set<HTMLElement>();
    const seen = new WeakSet<HTMLElement>();
    const show = (element: HTMLElement) => {
      if (seen.has(element)) return;
      seen.add(element);
      element.dataset.motionSeen = 'true';
      observer?.unobserve(element);
    };
    const scan = () => {
      frame = 0;
      if (media.matches) return;
      document.querySelectorAll<HTMLElement>(ITEMS).forEach(element => {
        if (items.has(element) || element.closest(SKIP) || element.parentElement?.closest(ITEMS)) return;
        if (!element.getClientRects().length) return;
        items.add(element);
        const siblings = Array.from(element.parentElement?.children ?? []).filter(sibling => sibling.matches(ITEMS));
        element.style.setProperty('--pf-enter-delay', `${Math.min(Math.max(0, siblings.indexOf(element)), 4) * 55}ms`);
        observer?.observe(element);
      });
    };
    const sync = () => {
      observer?.disconnect();
      if (media.matches || typeof IntersectionObserver === 'undefined') {
        items.forEach(element => { delete element.dataset.motionSeen; });
        return;
      }
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) show(entry.target as HTMLElement);
      }), { threshold: 0.06 });
      items.forEach(element => { if (!seen.has(element)) observer?.observe(element); });
      scan();
    };
    sync();
    media.addEventListener('change', sync);
    // Streaming and client filters can add content after the pathname has changed.
    const mutations = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(scan);
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer?.disconnect(); mutations.disconnect(); cancelAnimationFrame(frame);
      media.removeEventListener('change', sync);
      items.forEach(element => { delete element.dataset.motionSeen; element.style.removeProperty('--pf-enter-delay'); });
    };
  }, [route]);

  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.closest('[data-motion-skip]')) return;
      const next = new URL(link.href, location.href);
      if (next.origin !== location.origin || (next.pathname === location.pathname && next.search === location.search)) return;
      setPending(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setPending(false), 8000);
    };
    document.addEventListener('click', navigate, true);
    return () => { document.removeEventListener('click', navigate, true); if (timeout.current) clearTimeout(timeout.current); };
  }, []);

  return pending ? <div className="pf-route-progress fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-free-fill" role="status" aria-label="Đang mở trang">
    <span className="block h-full w-full origin-left bg-pitch" />
  </div> : null;
}
