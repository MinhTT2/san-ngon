import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Liên hệ — Sân Ngon',
  description: 'Hỏi về đơn đã đặt, đăng sân, hoặc báo lỗi.',
};

/**
 * Ba loại người vào đây: khách hỏi về đơn, chủ sân muốn đăng sân, và người
 * gặp lỗi. Chia sẵn ba đường, vì mỗi loại cần một câu trả lời khác nhau.
 */
export default function Page() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 lg:px-16">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-pitch lg:text-4xl">
        Liên hệ
      </h1>

      <div className="mt-9 flex flex-col gap-4">
        <Card title="Hỏi về đơn đã đặt">
          <p>
            Chủ sân trả lời nhanh hơn chúng tôi. Số điện thoại của họ nằm ngay trên trang sân, và
            mã đơn dạng <code className="font-display font-bold">SANxxxxxx</code> nằm trong{' '}
            <Link href="/don-cua-toi" className="font-semibold text-pitch underline underline-offset-2">
              Đơn của tôi
            </Link>
            . Nói mã đơn là họ tra ra ngay.
          </p>
        </Card>

        <Card title="Muốn đăng sân của bạn">
          <p>
            Điền hồ sơ ở trang{' '}
            <Link href="/dang-ky-san" className="font-semibold text-pitch underline underline-offset-2">
              Đăng sân
            </Link>
            . Chúng tôi gọi lại trong một ngày làm việc. Miễn phí, không ràng buộc.
          </p>
        </Card>

        <Card title="Chuyển khoản rồi mà đơn chưa xác nhận">
          <p>
            Đợi thêm khoảng một phút — hệ thống nhận tiền qua ngân hàng nên đôi lúc trễ. Quá năm
            phút mà vẫn chưa chuyển trạng thái thì nhắn cho chúng tôi kèm mã đơn và ảnh chụp màn
            hình giao dịch.
          </p>
        </Card>
      </div>

      <div className="mt-9 flex flex-col gap-2 rounded-card border border-strong bg-free-fill p-6">
        <span className="text-sm font-semibold">Nhắn trực tiếp</span>
        <a href="mailto:hello@sanngon.vn" className="font-display text-xl font-bold text-pitch">
          hello@sanngon.vn
        </a>
        <span className="text-sm text-ink-secondary">Hà Nội · trả lời trong giờ hành chính</span>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-hairline bg-card p-6">
      <h2 className="text-[17px] font-semibold">{title}</h2>
      <div className="text-[15px] leading-relaxed text-ink-secondary">{children}</div>
    </section>
  );
}
