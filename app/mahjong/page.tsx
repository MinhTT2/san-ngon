import { publicMetadata } from '@/lib/public-metadata';
import MahjongHome from './mahjong-home';

export const metadata = publicMetadata(
  'Mahjong — Build your set',
  'Khám phá bộ Mahjong cá tính và tự dựng set của riêng bạn.',
  '/mahjong',
);

export default function MahjongPage() {
  return <MahjongHome />;
}
