import { DeleteAction } from './delete-action';

export function TournamentDeleteForm({ id, title, successHref }: { id: string; title: string; successHref?: string }) {
  return <DeleteAction endpoint="/api/tournaments" payload={{ action: 'delete', id }} name={title} label="Xóa giải đấu"
    successHref={successHref} successMessage="Đã xóa giải đấu và trả lại lịch sân."
    description="Xóa giải cùng danh sách đăng ký và trả lại lịch sân. Giải đã có thông tin chuyển cọc, giao dịch hoặc thỏa thuận tiền thuê sẽ được giữ để đối soát." />;
}
