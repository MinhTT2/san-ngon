import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DataRequestForm } from '@/components/data-request-form';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dữ liệu cá nhân · Sân Ngon', robots: { index: false, follow: false } };
export default async function Page() {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/dang-nhap?next=/tai-khoan/du-lieu');
  return <main className="mx-auto max-w-4xl px-5 py-9"><Link href="/tai-khoan" className="inline-flex min-h-11 items-center text-sm text-pitch">← Tài khoản</Link><h1 className="mt-4 font-display text-3xl font-bold text-pitch">Dữ liệu cá nhân của bạn</h1>
    <p className="my-5 text-sm leading-7 text-ink-secondary">Tự sửa thông tin tại Tài khoản hoặc đổi quyền công khai ở Hồ sơ kết nối. Với phần khác, tải bản dữ liệu hoặc gửi yêu cầu để quản trị xử lý và phản hồi riêng.</p>
    <section className="my-6 rounded-card border border-hairline bg-card p-5"><h2 className="font-display text-xl font-bold text-pitch">Tải bản dữ liệu tài khoản</h2><p className="mt-3 text-sm leading-7 text-ink-secondary">File JSON gồm tài khoản, hồ sơ kết nối, đơn, đăng ký giải, lịch sử hoàn sân, yêu cầu và thông báo của chính bạn. Không gồm tệp giấy tờ/chứng từ tải lên, sao kê hay dữ liệu khách đặt sân của chủ sân; gửi yêu cầu nếu cần những phần này. Nếu quá giới hạn 1.000 bản ghi mỗi nhóm, admin hỗ trợ xuất đầy đủ.</p><a href="/api/privacy/export" className="mt-4 inline-flex min-h-11 items-center rounded-control border border-pitch px-4 text-sm font-semibold text-pitch">Tải dữ liệu JSON</a><p className="mt-3 text-xs leading-6 text-ink-secondary">File chứa thông tin riêng tư. Lưu ở nơi bạn kiểm soát.</p></section>
    <DataRequestForm /><Link href="/gop-y" className="mt-4 inline-flex min-h-11 items-center font-semibold text-pitch underline">Xem các yêu cầu của tôi →</Link>
    <p className="mt-5 text-xs leading-6 text-ink-secondary">Giấy tờ hồ sơ bị từ chối được đưa vào diện xem xét xóa sau 90 ngày; hỗ trợ đã kết thúc sau 180 ngày. Đây là mốc rà soát, không tự xóa. Hồ sơ đang hoạt động và dữ liệu gắn với tiền/nghĩa vụ còn mở được kiểm tra riêng. <Link href="/quyen-rieng-tu" className="underline">Chính sách quyền riêng tư</Link></p>
  </main>;
}
