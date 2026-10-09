import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return NextResponse.json({error:'Không tìm thấy chứng từ.'},{status:404,headers});
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:'Bạn cần đăng nhập.'},{status:401,headers});
  const {data,error}=await db.from('feedback').select('receipt_path').eq('id',id).maybeSingle();
  if(error) return NextResponse.json({error:'Chưa tải được chứng từ. Thử lại sau.'},{status:503,headers});
  if(!data?.receipt_path) return NextResponse.json({error:'Không tìm thấy chứng từ.'},{status:404,headers});
  const signed=await db.storage.from('payment-receipts').createSignedUrl(data.receipt_path,60);
  if(signed.error || !signed.data) return NextResponse.json({error:'Chưa mở được ảnh. Thử lại sau.'},{status:503,headers});
  return NextResponse.redirect(signed.data.signedUrl,{status:307,headers});
}
