import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export const metadata = { title: 'Nguồn hình ảnh — Sân Ngon' };
const sources = [
  { title: 'Bóng đá & cầu lông', creator: 'Unsplash', href: 'https://unsplash.com', license: 'Unsplash License', licenseHref: 'https://unsplash.com/license', description: 'Ảnh giới thiệu môn bóng đá và cầu lông. Đã thay đổi kích thước và định dạng để hiển thị trên website.' },
  { title: 'Pickleball Pros', creator: 'Picklerpeej', href: 'https://commons.wikimedia.org/w/index.php?curid=107275576', license: 'CC BY-SA 4.0', licenseHref: 'https://creativecommons.org/licenses/by-sa/4.0/', description: 'Ảnh giới thiệu môn pickleball. Đã thay đổi kích thước, nén thành WebP và cắt khung hiển thị. Phiên bản đã điều chỉnh được cung cấp theo cùng giấy phép CC BY-SA 4.0.' },
  { title: 'One on one in a soccer game', creator: 'Mixkit', href: 'https://mixkit.co/free-stock-video/one-on-one-in-a-soccer-game-43483/', license: 'Mixkit Stock Video Free License', licenseHref: 'https://mixkit.co/license/#videoFree', description: 'Video và ảnh đại diện dùng ở phần giới thiệu dành cho chủ sân.' },
];
export default function Page() {
  return <main className="mx-auto max-w-4xl px-5 py-8 lg:py-12">
    <Link href="/" className="pf-action inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-pitch"><ArrowLeft size={16} aria-hidden="true" />Trang chủ</Link>
    <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-pitch sm:text-4xl">Nguồn hình ảnh</h1>
    <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-secondary">Hình ảnh và video trên trang chủ minh họa không khí thể thao. Ảnh trên trang từng cụm sân do chủ sân cung cấp.</p>
    <div className="mt-8 space-y-4">{sources.map(source => <article key={source.title} className="rounded-card border border-hairline bg-card p-5 sm:p-7">
      <h2 className="font-display text-xl font-bold text-pitch">{source.title}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"><a href={source.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-semibold text-pitch underline underline-offset-4">{source.creator}<ExternalLink size={14} aria-hidden="true" /></a><a href={source.licenseHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-ink-secondary underline underline-offset-4">{source.license}</a></div>
      <p className="mt-2 text-sm leading-7 text-ink-secondary">{source.description}</p>
    </article>)}</div>
  </main>;
}
