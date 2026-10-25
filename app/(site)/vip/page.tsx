import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { vnd, dayLabel, hhmm } from '@/lib/format';
import { vietQrUrl } from '@/lib/sepay';
import { VIP_STATUS, type MyVip } from '@/lib/vip';
import { VipBuyButton } from '@/components/vip-actions';
import { QrImageActions } from '@/components/qr-image-actions';
import { LivePageRefresh } from '@/components/live-page-refresh';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mua tài khoản VIP · Sân Ngon' };
export default async function Page() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/vip');
  const { data, error } = await db.rpc('get_my_vip');
  if (error || !data) throw new Error('Chưa tải được thông tin VIP. Vui lòng thử lại.');
  const vip = data as MyVip;
  const open = vip.purchases.find(p => ['awaiting_payment', 'pending'].includes(p.status));
  const qr = open ? vietQrUrl(open.code, open.amount, open.bank, open.account_number) : null;
  return <main className="mx-auto max-w-5xl px-5 py-10 lg:py-16"><LivePageRefresh scope="vip" />
    <p className="text-xs font-semibold uppercase tracking-widest text-ink-secondary">Tài khoản / VIP</p>
    <h1 className="mt-3 font-display text-4xl font-bold text-pitch">Chơi thường xuyên, tiết kiệm hơn.</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-secondary">VIP giảm 10% tiền đặt sân. Bạn chỉ chuyển 90% giá sân và không phải trả thêm phần đã giảm. Áp dụng cho đơn đặt sân mới, không áp dụng phí giải đấu hay phí sử dụng website.</p>
    <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-card border border-hairline bg-card p-6"><h2 className="font-display text-2xl font-bold text-pitch">VIP · 49.000đ / tháng</h2><p className="mt-4 text-sm leading-7 text-ink-secondary">Hiệu lực một tháng từ khi admin duyệt. Gia hạn sớm được cộng tiếp vào hạn đang còn. Admin kiểm tra thanh toán và xử lý yêu cầu trong 30 phút kể từ khi bạn bấm gửi duyệt.</p>
        <p className="mt-5 font-semibold text-pitch">{vip.active ? 'VIP đang hoạt động' : 'VIP chưa hoạt động'}</p>
        {vip.paid_until && <p className="mt-2 text-sm text-ink-secondary">Hạn VIP: {dayLabel(new Date(vip.paid_until))} · {hhmm(vip.paid_until)}</p>}
        {!open && <div className="mt-6"><VipBuyButton /></div>}
        <Link href="/tim-san" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Tìm sân để chơi →</Link>
      </div>
      {open && qr ? <div className="rounded-card border border-hairline bg-card p-6"><h2 className="font-display text-xl font-bold text-pitch">{VIP_STATUS[open.status]}</h2>
        {open.status === 'awaiting_payment' ? <><p className="mt-3 text-sm leading-7 text-ink-secondary">Quét QR hoặc chuyển đúng số tiền và nội dung dưới đây. Chuyển xong, bấm gửi admin duyệt; chưa chuyển thì chưa cần bấm.</p><div className="mx-auto mt-5 max-w-60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR mua VIP ${open.code}, 49.000đ`} width={240} height={240} className="h-auto w-full rounded-control border border-hairline" />
          <QrImageActions src={qr} filename={open.code} /></div></> : <><p role="status" className="mt-3 text-sm leading-7 text-ink-secondary">Đã gửi admin đối soát. VIP được kích hoạt sau khi duyệt, không tự kích hoạt khi hết 30 phút. Không chuyển thêm lần nữa cho yêu cầu này.</p>{open.review_due_at && <p className="mt-3 text-sm">Dự kiến xử lý trước {hhmm(open.review_due_at)} · {dayLabel(new Date(open.review_due_at))}.</p>}<Link href="/lien-he" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-pitch underline">Liên hệ nếu quá 30 phút chưa được xử lý</Link></>}
        <dl className="mt-5 space-y-3 break-words text-sm"><Detail label="Ngân hàng" value={open.bank} /><Detail label="Số tài khoản" value={open.account_number} /><Detail label="Người nhận" value={open.account_name} /><Detail label="Số tiền" value={vnd(open.amount)} /><Detail label="Nội dung chuyển khoản" value={open.code} /></dl>
        {open.status === 'awaiting_payment' && <div className="mt-6"><VipBuyButton id={open.id} /></div>}
      </div> : <div className="rounded-card border border-hairline bg-page p-6"><h2 className="font-display text-xl font-bold text-pitch">Ba bước để dùng VIP</h2><ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-7 text-ink-secondary"><li>Tạo yêu cầu mua VIP để nhận mã chuyển khoản riêng.</li><li>Chuyển 49.000đ qua QR tài khoản admin.</li><li>Gửi duyệt, chờ admin đối soát trong 30 phút.</li></ol></div>}
    </section>
    <section className="mt-10"><h2 className="font-display text-2xl font-bold text-pitch">Lịch sử mua VIP</h2>{!vip.purchases.length ? <p className="mt-4 text-sm text-ink-secondary">Chưa có yêu cầu mua VIP.</p> : <ul className="mt-5 divide-y divide-hairline rounded-card border border-hairline bg-card">{vip.purchases.map(p => <li key={p.id} className="p-5 text-sm"><div className="flex flex-wrap justify-between gap-3"><strong className="break-all text-pitch">{p.code}</strong><span>{VIP_STATUS[p.status]} · {vnd(p.amount)}</span></div>{p.rejection_reason && <p className="mt-3 leading-7 text-danger">{p.rejection_reason} Nếu đã chuyển tiền, liên hệ hỗ trợ để đối soát trước khi mua lại.</p>}{p.period_end && <p className="mt-3 text-ink-secondary">Gia hạn đến {dayLabel(new Date(p.period_end))} · {hhmm(p.period_end)}</p>}</li>)}</ul>}</section>
  </main>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-wrap justify-between gap-2"><dt className="text-ink-secondary">{label}</dt><dd className="font-semibold text-pitch">{value}</dd></div>;
}
