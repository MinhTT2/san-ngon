'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUnsavedChanges } from '@/lib/use-unsaved-changes';

export function PaymentSupportForm({ userId, initialCode }: { userId: string; initialCode: string }) {
  const router = useRouter();
  const [code,setCode] = useState(initialCode);
  const [message,setMessage] = useState('');
  const [savedCode,setSavedCode] = useState(initialCode);
  const [fileReset,setFileReset] = useState(0);
  const [file,setFile] = useState<File | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [sent,setSent] = useState<string | null>(null);
  const uploaded = useRef<{ file: File; path: string } | null>(null);
  const request = useRef<{ body: string; id: string } | null>(null);
  const running = useRef(false);
  const dirty = !!message || !!file || code !== savedCode;
  const { markSaved } = useUnsavedChanges(dirty,busy);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    running.current=true; setBusy(true); setError(''); setSent(null);
    try {
      const db=createClient();
      if (file && uploaded.current?.file !== file) {
        const ext = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[file.type];
        if (!ext || file.size>5*1024*1024 || file.size===0) throw new Error('Chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MiB.');
        const path=userId+'/'+crypto.randomUUID()+'.'+ext;
        const { error }=await db.storage.from('payment-receipts').upload(path,file,{ contentType:file.type,upsert:false });
        if (error) throw new Error('Chưa tải được chứng từ. Nội dung vẫn được giữ; hãy thử lại.');
        uploaded.current={file,path};
      }
      const payload={code:code.trim().toUpperCase(),message:message.trim(),receipt_path:file ? uploaded.current?.path ?? null : null};
      const body=JSON.stringify(payload);
      if (request.current?.body !== body) request.current={body,id:crypto.randomUUID()};
      const response=await fetch('/api/payment-support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,id:request.current.id})});
      const result=await response.json().catch(()=>null);
      if (!response.ok) throw new Error(result?.error || 'Chưa gửi được yêu cầu. Nội dung vẫn được giữ.');
      if (!result || typeof result.id !== 'string') throw new Error('Chưa xác nhận được kết quả. Thử lại cùng nội dung để tránh gửi trùng.');
      markSaved(); setSavedCode(code); setFileReset(value=>value+1); setSent(result.id); setMessage(''); setFile(null); uploaded.current=null; request.current=null; router.refresh();
    } catch (error) {
      setError(error instanceof TypeError ? 'Mạng bị gián đoạn. Thử lại cùng nội dung; hệ thống không tạo yêu cầu trùng.' : error instanceof Error ? error.message : 'Chưa gửi được yêu cầu.');
    } finally { running.current=false; setBusy(false); }
  }
  return <form onSubmit={submit} data-unsaved-changes={dirty} data-unsaved-busy={busy} aria-busy={busy} className="mt-7 rounded-card border border-hairline bg-card p-5 sm:p-7">
    <p className="text-sm leading-7 text-ink-secondary">Chỉ bạn và quản trị xem được nội dung và ảnh. Che số dư, giao dịch khác và thông tin nhạy cảm; giữ mã giao dịch, số tiền, thời gian, người nhận và nội dung chuyển khoản.</p>
    <fieldset disabled={busy} className="mt-5 space-y-5 disabled:opacity-60">
      <label className="block text-sm font-semibold">Mã đơn sân<input name="code" value={code} onChange={event=>setCode(event.target.value)} required pattern="SAN[A-HJ-NP-Z2-9]{6}" maxLength={9} className={field} placeholder="SANxxxxxx" autoCapitalize="characters" /></label>
      <label className="block text-sm font-semibold">Nội dung cần đối soát<textarea name="message" value={message} onChange={event=>setMessage(event.target.value)} required minLength={20} maxLength={3000} rows={5} className={field} placeholder="Ghi số tiền, thời gian chuyển, mã giao dịch và tình trạng đang gặp…" /><span className="mt-2 block text-xs font-normal text-ink-secondary">20–3.000 ký tự. Không gửi mật khẩu hoặc OTP.</span></label>
      <label className="block text-sm font-semibold">Ảnh chứng từ (không bắt buộc)<input key={fileReset} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{setFile(event.target.files?.[0]??null);setSent(null);setError('');}} className="mt-2 block min-h-11 w-full rounded-control border border-hairline p-3 text-sm font-normal" /><span className="mt-2 block text-xs font-normal text-ink-secondary">JPEG, PNG hoặc WebP · tối đa 5 MiB · lưu riêng tư.</span></label>
      <button className="min-h-11 rounded-control bg-pitch px-5 py-3 text-sm font-semibold text-pitch-ink">{busy ? 'Đang gửi…' : 'Gửi yêu cầu đối soát'}</button>
    </fieldset>
    {error && <p role="alert" className="mt-4 text-sm leading-7 text-danger">{error}</p>}
    {sent && <div role="status" className="mt-4 rounded-control bg-free-fill p-4 text-sm text-pitch">Đã tiếp nhận. <Link href={'/gop-y#gop-y-'+sent} className="inline-flex min-h-11 items-center font-semibold underline">Theo dõi yêu cầu và phản hồi →</Link></div>}
    <p className="mt-5 text-xs leading-6 text-ink-secondary">Gửi chứng từ không xác nhận tiền, không khôi phục giữ chỗ và không hủy đơn. Tối đa 5 yêu cầu trong 24 giờ và 10 yêu cầu đang xử lý.</p>
  </form>;
}
const field='mt-2 block min-h-11 w-full rounded-control border border-hairline bg-page px-3 py-3 text-sm font-normal';
