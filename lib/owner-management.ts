import { z } from 'zod';

export const VenueManagementBody = z.object({
  name: z.string().trim().min(3, 'Nhập tên cụm sân.').max(120),
  address: z.string().trim().min(3, 'Nhập địa chỉ sân.').max(200),
  district: z.string().trim().min(2, 'Chọn quận/huyện.'),
  phone: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.'),
  description: z.string().trim().max(500, 'Giới thiệu không quá 500 ký tự.').nullable().optional(),
  open_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  deposit_pct: z.number().int().min(0).max(100),
  booking_horizon_days: z.number().int().min(1).max(180),
});

const CourtManagementShape = z.object({
  name: z.string().trim().min(1, 'Nhập tên sân con.').max(80),
  sport: z.enum(['football5', 'football7', 'football11', 'badminton', 'pickleball', 'tennis']),
  surface: z.string().trim().max(80).nullable().optional(),
  is_indoor: z.boolean(),
  slot_minutes: z.number().int().refine((value) => [30, 60, 90, 120].includes(value), 'Thời lượng khung không hợp lệ.'),
  open_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  close_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  is_active: z.boolean().default(true),
  price_per_hour: z.number().int().min(1000).max(10_000_000),
});

function validateCourtHours(value: z.infer<typeof CourtManagementShape>, ctx: z.RefinementCtx) {
  if ((value.open_time === null) !== (value.close_time === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['open_time'], message: 'Giờ mở và đóng phải nhập cùng nhau.' });
  }
}

export const CourtManagementBody = CourtManagementShape.superRefine(validateCourtHours);

export const CourtCreateBody = CourtManagementShape.extend({ venue_id: z.string().uuid('Thông tin cụm sân không hợp lệ.') }).superRefine(validateCourtHours);

export type VenueManagementInput = z.infer<typeof VenueManagementBody>;
export type CourtManagementInput = z.infer<typeof CourtManagementBody>;
