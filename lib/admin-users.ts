import { z } from 'zod';

export const UserBody = z.object({
  full_name: z.string().trim().min(2, 'Nhập họ tên, ít nhất 2 ký tự.').max(100),
  phone: z.string().trim().regex(/^$|^0\d{9}$/, 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.'),
  role: z.enum(['player', 'owner', 'admin']),
});
export const NewUserBody = UserBody.extend({
  email: z.string().trim().email('Email không hợp lệ.').max(254),
  password: z.string().min(12, 'Mật khẩu cần ít nhất 12 ký tự.').refine((s) => new TextEncoder().encode(s).length <= 72, 'Mật khẩu tối đa 72 byte.'),
});
export const UserActionBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ban'), reason: z.string().trim().min(5, 'Nhập lý do khóa, ít nhất 5 ký tự.').max(500), days: z.union([z.literal(0), z.literal(1), z.literal(7), z.literal(30)]) }),
  z.object({ action: z.literal('unban') }),
]);
export function adminUserError(raw: string) {
  const errors: Record<string, string> = {
    FORBIDDEN: 'Bạn không có quyền quản lý tài khoản.', ACCOUNT_BANNED: 'Tài khoản của bạn đang bị khóa.',
    EMAIL_EXISTS: 'Email này đã có tài khoản.', USER_NOT_FOUND: 'Không tìm thấy tài khoản.',
    SELF_PROTECTED: 'Bạn không thể khóa, xóa hoặc đổi vai trò của chính mình.',
    LAST_ADMIN: 'Cần giữ lại ít nhất một quản trị viên đang hoạt động.',
    OWNER_HAS_VENUES: 'Chủ sân đang có cụm sân, chưa thể đổi vai trò.',
    USER_HAS_DATA: 'Tài khoản đã có sân, đơn hoặc giấy tờ. Hãy khóa tài khoản để giữ lại dữ liệu.',
    INVALID_INPUT: 'Thông tin không hợp lệ. Vui lòng kiểm tra lại.',
  };
  const key = Object.keys(errors).find((key) => raw.includes(key));
  return { error: key ? errors[key] : 'Không lưu được tài khoản. Vui lòng thử lại.', status: key === 'FORBIDDEN' || key === 'ACCOUNT_BANNED' ? 403 : key ? 400 : 500 };
}
export type AdminUser = {
  id: string; full_name: string | null; phone: string | null; email: string | null;
  role: 'player' | 'owner' | 'admin'; created_at: string;
  is_banned: boolean; banned_until: string | null; ban_reason: string | null; banned_at: string | null;
};
export type UserList = { users: AdminUser[]; total: number; active: number; banned: number };
export const ROLE_LABELS = { player: 'Người chơi', owner: 'Chủ sân', admin: 'Quản trị viên' };
