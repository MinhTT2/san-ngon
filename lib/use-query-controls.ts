'use client';
import { useSearchParams } from 'next/navigation';

/** Native history keeps typing local while Next retains the query on refresh/back. */
export function useQueryControls() {
  const params = useSearchParams();
  const update = (values: Record<string, string | null>, push = false) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    if (push) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  };
  return { params, update };
}
