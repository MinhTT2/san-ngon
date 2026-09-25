import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { PriceEditor } from './price-editor';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/dang-nhap?next=/chu-san/bang-gia/${id}`);
  const { data: court, error } = await supabase.from('courts')
    .select('id, name, venues!inner(name, owner_id), price_rules(*)')
    .eq('id', id).eq('venues.owner_id', user.id).maybeSingle();
  if (error) throw new Error('Không tải được bảng giá. Vui lòng thử lại.');
  if (!court) notFound();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 lg:px-10">
      <Link href="/chu-san/quan-ly" className="text-sm font-semibold text-pitch underline">← Quản lý sân</Link>
      <h1 className="mt-5 font-display text-3xl font-extrabold text-pitch">Bảng giá · {court.name}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
        Giá tính theo giờ bắt đầu mỗi khung. Khi nhiều mức giá trùng nhau, mức có độ ưu tiên cao hơn được áp dụng; cùng ưu tiên thì lấy giá cao hơn. Thay đổi chỉ áp dụng cho đơn mới.
      </p>
      <PriceEditor courtId={id} initialRules={court.price_rules} />
    </main>
  );
}
