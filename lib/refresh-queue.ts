/** Coalesce updates and keep one pending refresh while the user is editing. */
export function createRefreshQueue(refresh: () => void, allowed: () => boolean, delay = 250) {
  let pending = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (disposed || !pending || timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      if (disposed || !pending || !allowed()) return;
      pending = false;
      refresh();
    }, delay);
  };
  return {
    request() { if (!disposed) { pending = true; flush(); } },
    flush,
    dispose() { disposed = true; pending = false; clearTimeout(timer); },
  };
}
