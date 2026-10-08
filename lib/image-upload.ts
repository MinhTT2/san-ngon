export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const IMAGE_HINT = 'JPG, PNG, WebP · Tối đa 5 MB';

export async function validateImage(file: File) {
  if (!IMAGE_ACCEPT.split(',').includes(file.type) || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error('Chọn ảnh JPG, PNG hoặc WebP, tối đa 5 MB.');
  }
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
  } catch {
    throw new Error('Không đọc được ảnh này. Bạn thử chọn ảnh khác nhé.');
  }
}

export function imagePath(userId: string, file: File) {
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  return `${userId}/${crypto.randomUUID()}.${extension}`;
}

export function tournamentCoverSrc(path: string | null) {
  if (!path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tournament-photos/${path}`;
}


export function venuePhotoSrc(path: string | null | undefined) {
  if (!path || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/venue-photos/${path}`;
}
