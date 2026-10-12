import type { BookingStatus } from '@/lib/types';

export const ADMIN_BOOKING_GROUPS = [
  { value: 'upcoming', label: 'Sắp chơi', hint: 'Đã cọc · gần nhất trước', count: 'upcoming' },
  { value: 'pending', label: 'Chờ cọc', hint: 'Sắp hết hạn trước', count: 'pending' },
  { value: 'refund', label: 'Cần hoàn', hint: 'Chủ sân chưa hoàn cọc', count: 'refund' },
  { value: 'history', label: 'Lịch sử', hint: 'Đã xong, đã hủy, hết hạn', count: 'history' },
  { value: 'all', label: 'Tất cả', hint: 'Tra cứu mọi đơn đặt sân', count: 'total' },
] as const;
export type AdminBookingFilter = typeof ADMIN_BOOKING_GROUPS[number]['value'];
export type AdminBookingParams = { filter?: string; status?: string; q?: string; from?: string; to?: string; page?: string };
export type AdminBooking = {
  id: string; code: string; starts_at: string; ends_at: string; created_at: string;
  expires_at: string; cancelled_at: string | null; paid_at: string | null;
  status: BookingStatus; total_amount: number; deposit_amount: number;
  refund_status: string | null; customer_name: string | null; customer_phone: string;
  court_name: string; venue_name: string; owner_id: string; owner_name: string | null;
  owner_phone: string | null; note: string | null; hold_expired: boolean; is_playing: boolean;
};
export type AdminBookingResult = {
  rows: AdminBooking[]; total: number; upcoming: number; pending: number; refund: number; history: number;
  matched: number; page: number; pages: number; page_size: number;
};
