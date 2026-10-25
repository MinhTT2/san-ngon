'use client';

import Script from 'next/script';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ANALYTICS_ORIGIN, DISCOVERY_EVENTS, analyticsPage, analyticsReferrer } from '@/lib/analytics';

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const [loadScript, setLoadScript] = useState(false);
  const [ready, setReady] = useState(false);
  const state = useRef({ initialized: false, lastPath: null as string | null, referrer: null as string | null });

  useLayoutEffect(() => {
    const target = window as unknown as AnalyticsWindow;
    const page = window.location.origin === ANALYTICS_ORIGIN ? analyticsPage(pathname) : null;
    // Set this before SDK callbacks run, including when it finishes loading on a private page.
    target[`ga-disable-${measurementId}`] = !page;
    if (!page) {
      state.current.lastPath = null;
      state.current.referrer = `${ANALYTICS_ORIGIN}/`;
      return;
    }
    setLoadScript(true);
    if (!ready || state.current.lastPath === pathname) return;

    target.dataLayer ??= [];
    // Google's command queue expects the gtag function's Arguments object.
    // eslint-disable-next-line prefer-rest-params
    target.gtag ??= function () { target.dataLayer!.push(arguments); };
    if (!state.current.initialized) {
      target.gtag('js', new Date());
      state.current.initialized = true;
    }
    const fields = {
      ...page,
      page_referrer: state.current.referrer ?? analyticsReferrer(document.referrer),
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    };
    // Enhanced Measurement must also be disabled in the GA4 stream settings.
    target.gtag('config', measurementId, fields);
    target.gtag('event', 'page_view', { ...fields, send_to: measurementId });
    state.current.lastPath = pathname;
    state.current.referrer = page.page_location;
  }, [measurementId, pathname, ready]);

  useEffect(() => {
    if (!ready) return;
    function send(name: string) {
      const target = window as unknown as AnalyticsWindow;
      const page = window.location.origin === ANALYTICS_ORIGIN ? analyticsPage(window.location.pathname) : null;
      if (!page || target[`ga-disable-${measurementId}`] || !Object.hasOwn(DISCOVERY_EVENTS, name)) return;
      target.gtag?.('event', name, { ...page, page_referrer: state.current.referrer ?? '', send_to: measurementId });
    }
    function event(e: Event) { if (e instanceof CustomEvent && typeof e.detail === 'string') send(e.detail); }
    function click(e: MouseEvent) {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href);
      if (url.origin === ANALYTICS_ORIGIN && /^\/san\//.test(url.pathname) && analyticsPage(url.pathname)) send('discovery_venue_open');
    }
    function submit(e: SubmitEvent) {
      if (!(e.target instanceof HTMLFormElement) || e.target.method.toLowerCase() !== 'get') return;
      const url = new URL(e.target.action);
      if (url.origin === ANALYTICS_ORIGIN && url.pathname === '/tim-san') send('discovery_search');
    }
    window.addEventListener('san-ngon:discovery', event);
    document.addEventListener('click', click);
    document.addEventListener('submit', submit);
    return () => {
      window.removeEventListener('san-ngon:discovery', event);
      document.removeEventListener('click', click);
      document.removeEventListener('submit', submit);
    };
  }, [measurementId, ready]);

  if (!loadScript) return null;
  return <Script id="san-ngon-ga4" src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
    strategy="afterInteractive" onReady={() => setReady(true)} />;
}
