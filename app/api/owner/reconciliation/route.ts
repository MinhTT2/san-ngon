import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { reconciliationCsv,type ReconciliationRow } from '@/lib/reconciliation-csv';
const schema=z.object({venue:z.string().uuid(),from:z.string().date(),to:z.string().date()});
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 const parsed=schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
 if(!parsed.success)return NextResponse.json({error:'Chọn cụm sân và hai ngày hợp lệ.'},{status:400,headers});
 const db=await createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)return NextResponse.json({error:'Bạn cần đăng nhập.'},{status:401,headers});
 const d=parsed.data;
 const {data,error}=await db.rpc('get_owner_reconciliation_export',{p_venue_id:d.venue,p_from:d.from,p_to:d.to});
 if(error)return NextResponse.json({error:error.message==='INVALID_DATE_RANGE'?'Chọn khoảng từ ngày đến ngày không quá 366 ngày.':error.message==='EXPORT_TOO_LARGE'?'Khoảng này có hơn 10.000 đơn. Chọn khoảng ngắn hơn.':'Chưa xuất được danh sách. Kiểm tra quyền cụm sân hoặc thử lại.'},{status:error.code==='42501'?403:error.code==='22023'?400:503,headers});
 const result=data as unknown as {rows:ReconciliationRow[]};
 return new NextResponse(reconciliationCsv(result.rows),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="san-ngon-'+d.from+'-'+d.to+'.csv"','X-Content-Type-Options':'nosniff'}});
}
