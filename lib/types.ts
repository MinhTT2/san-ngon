export type Sport =
  | 'football5' | 'football7' | 'football11'
  | 'badminton' | 'pickleball' | 'tennis';

export type VenueStatus = 'draft' | 'pending' | 'active' | 'rejected';
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type RefundStatus = 'none' | 'needed' | 'done';

/** Một dòng trả về từ RPC get_venue_availability. */
export type Slot = {
  court_id: string;
  court_name: string;
  sport: Sport;
  slot_minutes: number;
  starts_at: string; // ISO, UTC
  ends_at: string;
  price: number;
  is_available: boolean;
  slot_status?: 'available' | 'held' | 'booked' | 'unavailable';
  hold_expires_at?: string | null;
};

export type Venue = {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  address: string;
  district: string;
  city: string;
  phone: string | null;
  description: string | null;
  images: string[];
  amenities: string[];
  open_time: string;
  close_time: string;
  deposit_pct: number;
  booking_horizon_days: number;
  status: VenueStatus;
};

export type Court = {
  id: string;
  venue_id: string;
  name: string;
  sport: Sport;
  surface: string | null;
  is_indoor: boolean;
  slot_minutes: number;
  open_time: string | null;
  close_time: string | null;
  is_active: boolean;
  sort_order: number;
};

export type Booking = {
  id: string;
  code: string;
  court_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  total_amount: number;
  deposit_amount: number;
  status: BookingStatus;
  refund_status: RefundStatus | null;
  customer_name: string | null;
  customer_phone: string;
  note: string | null;
  expires_at: string;
  paid_at: string | null;
};

/** Kết quả confirm_payment trả về cho webhook. */
export type ConfirmPaymentResult = {
  ok: boolean;
  reason: string;
  code?: string;
  booking_id?: string;
  owner_id?: string;
  court_name?: string;
  venue_name?: string;
  starts_at?: string;
  ends_at?: string;
  total_amount?: number;
  deposit_amount?: number;
  customer_name?: string | null;
  customer_phone?: string;
  owner_telegram_chat_id?: string | null;
};

/** Lựa chọn hiện tại trong lưới lịch. */
export type Selection = {
  courtId: string;
  courtName: string;
  startsAt: string;
  endsAt: string;
  total: number;
  slots: Slot[];
};

/** Hồ sơ cụm sân của chủ sân, dùng ở /dang-ky-san. */
export type OwnerVenue = Pick<
  Venue,
  'id' | 'slug' | 'name' | 'address' | 'district' | 'phone' | 'status'
>;

/** Ngày và giới hạn đặt trước do SQL tính theo giờ Việt Nam. */
export type VenueCalendar = {
  today: string;
  last_date: string;
  date: string;
  days: { date: string; weekday: number }[];
};
