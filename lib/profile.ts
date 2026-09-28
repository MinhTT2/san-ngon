/** Chuẩn hóa đầu vào; SQL kiểm tra và chuẩn hóa lại trước khi lưu. */
export function normalizePhone(value: string) {
  return value.replace(/[\s().-]/g, '').replace(/^\+84/, '0');
}

export function avatarSrc(value: string | null) {
  if (!value) return null;
  if (/^https:\/\//.test(value) || value.startsWith('blob:')) return value;
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(value)) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${value}`;
}
