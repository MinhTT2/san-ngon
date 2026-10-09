'use client';

import { useEffect, useRef } from 'react';

const WARNING = 'Bạn có thay đổi chưa lưu. Rời khỏi đây sẽ bỏ nội dung đang sửa. Bạn vẫn muốn tiếp tục?';

/** Also used by modal close buttons, Escape and backdrop clicks. */
export function canCloseUnsavedForm(root: HTMLElement | null) {
  if (root?.querySelector('[data-unsaved-busy="true"]')) return false;
  return !root?.querySelector('[data-unsaved-changes="true"]') || window.confirm(WARNING);
}

export function useUnsavedChanges(dirty: boolean, busy = false) {
  const current = useRef({ dirty, busy });
  current.current = { dirty, busy };
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!current.current.dirty && !current.current.busy) return;
      event.preventDefault(); event.returnValue = '';
    };
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.download || (anchor.target && anchor.target !== '_self')) return;
      const next = new URL(anchor.href);
      if (!['http:', 'https:'].includes(next.protocol)) return;
      if (next.origin === location.origin && next.pathname === location.pathname && next.search === location.search) return;
      if (current.current.busy || (current.current.dirty && !window.confirm(WARNING))) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    // Navigation API can cancel same-document Back/Forward before Next changes route.
    const history = (event: Event) => {
      const navigation = event as Event & { navigationType?: string; hashChange?: boolean };
      if (navigation.navigationType !== 'traverse' || navigation.hashChange || !event.cancelable) return;
      if (current.current.busy || (current.current.dirty && !window.confirm(WARNING))) event.preventDefault();
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    navigation?.addEventListener('navigate', history);
    return () => {
      window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true);
      navigation?.removeEventListener('navigate', history);
    };
  }, []);
  return {
    confirmDiscard: () => !current.current.busy && (!current.current.dirty || window.confirm(WARNING)),
    markSaved: () => { current.current = { dirty: false, busy: false }; },
  };
}
