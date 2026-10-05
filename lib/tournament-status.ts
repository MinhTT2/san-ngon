import type { Database } from './database.types';

type Tournament = Database['public']['Tables']['tournaments']['Row'];
type Registration = Database['public']['Tables']['tournament_registrations']['Row'];
export const tournamentStatuses: Record<string, string> = { pending: 'Chờ admin duyệt', published: 'Đã công khai', rejected: 'Không được duyệt', cancelled: 'Đã hủy', completed: 'Đã kết thúc' };
export const registrationStatuses: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Được tham gia', rejected: 'Không được duyệt', cancelled: 'Đã hủy', expired: 'Hết hạn' };
export const paymentOutcomes: Record<string, string> = { paid: 'Đã nhận đủ cọc', overpaid: 'Chuyển thừa', underpaid: 'Chuyển thiếu', duplicate_payment: 'Chuyển trùng', late_or_cancelled: 'Quá hạn / đăng ký đã hủy' };

export function registrationLabel(registration: Pick<Registration, 'status' | 'paid_at' | 'deposit_amount'>) {
  if (registration.status !== 'approved') return registrationStatuses[registration.status] ?? 'Chưa xác định';
  return registration.paid_at || registration.deposit_amount === 0 ? 'Đã xác nhận tham gia' : 'Chờ đóng cọc';
}
export function tournamentLabel(tournament: Pick<Tournament, 'status' | 'starts_at' | 'ends_at' | 'registration_deadline'>, now = Date.now()) {
  if (tournament.status !== 'published') return tournamentStatuses[tournament.status];
  if (Date.parse(tournament.ends_at) <= now) return 'Đã kết thúc';
  if (Date.parse(tournament.starts_at) <= now) return 'Đang diễn ra';
  return Date.parse(tournament.registration_deadline) <= now ? 'Đã đóng đăng ký' : 'Đang nhận đăng ký';
}
