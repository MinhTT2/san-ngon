import { z } from 'zod';

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Nhập giờ hợp lệ.');
const Sport = z.enum(['football5', 'football7', 'football11', 'badminton', 'pickleball', 'tennis']);
const Price = z.number().int('Giá phải là số nguyên.').min(1000, 'Nhập giá từ 1.000 đồng/giờ.').max(10_000_000, 'Giá tối đa 10.000.000 đồng/giờ.');
const VenueShape = z.object({
  name: z.string().trim().min(3, 'Nhập tên cụm sân, ít nhất 3 ký tự.').max(120, 'Tên cụm sân không quá 120 ký tự.'),
  address: z.string().trim().min(3, 'Nhập địa chỉ sân.').max(200, 'Địa chỉ không quá 200 ký tự.'),
  district: z.string().trim().min(2, 'Chọn quận/huyện.').max(60, 'Quận/huyện không quá 60 ký tự.'),
  phone: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.'),
  description: z.string().trim().max(500, 'Giới thiệu không quá 500 ký tự.').nullable().optional(),
  open_time: Time,
  close_time: Time,
});

function validateHours(value: { open_time: string | null; close_time: string | null }, ctx: z.RefinementCtx) {
  if (value.open_time && value.close_time && value.close_time <= value.open_time) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['close_time'], message: 'Giờ đóng cửa phải sau giờ mở cửa.' });
  }
}

export const VenueDetailsBody = VenueShape.superRefine(validateHours);
export const VenueCreateBody = VenueShape.extend({
  sports: z.array(z.object({
    sport: Sport,
    court_count: z.number().int('Nhập số sân nguyên.').min(1, 'Cần ít nhất 1 sân.').max(20, 'Tối đa 20 sân.'),
    price_per_hour: Price,
  })).min(1, 'Chọn ít nhất một môn thể thao.').max(6).superRefine((sports, ctx) => {
    if (new Set(sports.map((item) => item.sport)).size !== sports.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Mỗi môn thể thao chỉ chọn một lần.' });
    if (sports.reduce((total, item) => total + item.court_count, 0) > 20) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Tổng số sân con không được quá 20 sân.' });
  }),
}).superRefine(validateHours);

export const VenueManagementBody = VenueShape.extend({
  deposit_pct: z.literal(100, { errorMap: () => ({ message: 'Tiền cọc bằng 100% tiền sân.' }) }),
  booking_horizon_days: z.number().int().min(1, 'Nhận đặt trước từ 1 đến 180 ngày.').max(180, 'Nhận đặt trước từ 1 đến 180 ngày.'),
}).superRefine(validateHours);

const CourtManagementShape = z.object({
  name: z.string().trim().min(1, 'Nhập tên sân.').max(80, 'Tên sân không quá 80 ký tự.'),
  sport: Sport,
  surface: z.string().trim().max(80, 'Mặt sân không quá 80 ký tự.').nullable().optional(),
  is_indoor: z.boolean(),
  slot_minutes: z.number().int().refine((value) => [30, 60, 90, 120].includes(value), 'Thời lượng khung không hợp lệ.'),
  open_time: Time.nullable(),
  close_time: Time.nullable(),
  is_active: z.boolean().default(true),
  price_per_hour: Price,
});

function validateCourtHours(value: z.infer<typeof CourtManagementShape>, ctx: z.RefinementCtx) {
  if ((value.open_time === null) !== (value.close_time === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['open_time'], message: 'Giờ mở và đóng phải nhập cùng nhau.' });
  }
  validateHours(value, ctx);
}

export const CourtManagementBody = CourtManagementShape.superRefine(validateCourtHours);
export const CourtCreateBody = CourtManagementShape.extend({ venue_id: z.string().uuid('Thông tin cụm sân không hợp lệ.') }).superRefine(validateCourtHours);

export function validationFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join('.')] ??= issue.message;
  return fields;
}

/** Attach SQL validation errors to their inputs; SQL remains authoritative. */
export function rpcFieldErrors(raw: string, message: string): Record<string, string> {
  const fields: Record<string, string> = {
    COURT_NAME_EXISTS: 'name', COURT_NAME_REQUIRED: 'name', COURT_NAME_TOO_LONG: 'name',
    NAME_REQUIRED: 'name', NAME_TOO_LONG: 'name', ADDRESS_REQUIRED: 'address', ADDRESS_TOO_LONG: 'address',
    PHONE_INVALID: 'phone', DISTRICT_REQUIRED: 'district', INVALID_HOURS: 'close_time',
    COURT_HOURS_PAIR_REQUIRED: 'open_time', COURT_HOURS_OUTSIDE_VENUE: 'open_time',
    PRICE_INVALID: 'price_per_hour', SLOT_MINUTES_INVALID: 'slot_minutes',
    COURT_COUNT_RANGE: 'sports', SPORT_DUPLICATE: 'sports', SPORT_CONFIG_INVALID: 'sports',
    DEPOSIT_INVALID: 'deposit_pct', HORIZON_INVALID: 'booking_horizon_days',
  };
  const code = Object.keys(fields).find((key) => raw.includes(key));
  return code ? { [fields[code]]: message } : {};
}

export type VenueManagementInput = z.infer<typeof VenueManagementBody>;
export type CourtManagementInput = z.infer<typeof CourtManagementBody>;
