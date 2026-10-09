import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PaymentSupportForm } from '@/components/payment-support-form';
export const dynamic='force-dynamic';
export const metadata={title:'Hỗ trợ chuyển khoản — Sân Ngon',robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{code?:string}>}) {
  const params=await searchParams;
  const code=typeof params.code==='string' && /^SAN[A-HJ-NP-Z2-9]{6}$/i.test(params.code) ? params.code.toUpperCase() : '';
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next='+encodeURIComponent('/ho-tro-giao-dich'+(code?'?code='+code:'')));
  return <main className="mx-auto max-w-3xl px-5 py-10"><h1 className="font-display text-3xl font-bold text-pitch">Hỗ trợ chuyển khoản</h1><p className="mt-3 text-sm leading-7 text-ink-secondary">Đã chuyển tiền nhưng đơn chưa xác nhận, chuyển nhầm nội dung hoặc đang chờ hoàn cọc? Gửi thông tin để quản trị hỗ trợ đối soát với chủ sân.</p><PaymentSupportForm userId={user.id} initialCode={code}/><Link href="/gop-y" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Xem lịch sử hỗ trợ</Link></main>;
}
