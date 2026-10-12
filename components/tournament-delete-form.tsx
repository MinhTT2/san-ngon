import { DeleteAction } from './delete-action';

export function TournamentDeleteForm({ id, title, successHref, admin = true }: { id: string; title: string; successHref?: string; admin?: boolean }) {
  return <DeleteAction endpoint="/api/tournaments" payload={{ action: 'delete', id }} name={title} label="Xóa giải đấu"
    successHref={successHref} successMessage="Đã xóa giải đấu và trả lại lịch sân."
    description={admin
      ? 'Admin được xóa vĩnh viễn giải, danh sách đăng ký, giao dịch cọc và quyết toán kể cả khi đã có thông tin tài chính. Lịch sân sẽ được mở lại. Thao tác này không chuyển tiền hoàn; cần đối soát và xử lý các khoản còn lại trước khi xóa.'
      : 'Xóa giải cùng danh sách đăng ký và trả lại lịch sân. Giải đã có thông tin chuyển cọc, giao dịch hoặc thỏa thuận tiền thuê sẽ được giữ để đối soát.'} />;
}
