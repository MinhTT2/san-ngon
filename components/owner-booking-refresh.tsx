'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingUpdates } from '@/lib/use-booking-updates';

export function OwnerBookingRefresh() {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useBookingUpdates(refresh);
  return null;
}
