'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function RefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [router]);
  return null;
}
