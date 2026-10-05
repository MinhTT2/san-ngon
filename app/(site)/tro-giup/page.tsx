import { HelpCenter } from '@/components/help-center';

export const metadata = { title: 'Trợ giúp & câu hỏi thường gặp — Sân Ngon', description: 'Hướng dẫn đặt sân, chuyển cọc, hủy đơn, giải đấu và tài khoản trên Sân Ngon.' };
export default function Page() {
  return <main className="mx-auto max-w-5xl px-5 py-10 lg:px-12"><h1 className="font-display text-3xl font-extrabold text-pitch sm:text-4xl">Bạn cần trợ giúp gì?</h1><p className="mt-3 text-sm leading-7 text-ink-secondary">Tìm hướng dẫn nhanh cho buổi chơi và tài khoản của bạn.</p><HelpCenter /></main>;
}
