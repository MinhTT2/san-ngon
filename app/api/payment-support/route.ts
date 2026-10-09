import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requestOrigin } from '@/lib/request-origin';
import { feedbackErrors } from '@/lib/feedback';
const schema=z.object({id:z.string().uuid(),code:z.string().trim().toUpperCase().regex(/^SAN[A-HJ-NP-Z2-9]{6}$/),message:z.string().trim().min(20).max(3000),receipt_path:z.string().max(100).nullable().default(null)});
export async function POST(request:Request) {
  if(request.headers.get('origin')!==requestOrigin(request)) return NextResponse.json({error:'Yêu cầu không hợp lệ.'},{status:403});
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:'Bạn cần đăng nhập.'},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:'Kiểm tra mã đơn và nội dung 20–3.000 ký tự.'},{status:400});
  const d=parsed.data;
  const {data,error}=await db.rpc('submit_payment_support',{p_id:d.id,p_code:d.code,p_message:d.message,p_receipt_path:d.receipt_path});
  if(error) return NextResponse.json({error:feedbackErrors[error.message] ?? ({BOOKING_NOT_FOUND:'Không tìm thấy mã đơn thuộc tài khoản của bạn.',INVALID_RECEIPT:'Chứng từ chưa hợp lệ. Hãy tải lại ảnh.'}[error.message]) ?? 'Chưa gửi được yêu cầu. Nội dung vẫn được giữ.'},{status:error.code==='42501'?403:error.code==='22023'?400:500});
  return NextResponse.json({id:data});
}
