import { ActionForm } from './action-form';

export function TournamentDeleteForm({ id, title, successHref }: { id: string; title: string; successHref?: string }) {
  return <ActionForm payload={{ action: 'delete', id }} label="Xóa giải đấu" variant="danger"
    successHref={successHref} successMessage="Đã xóa giải đấu và trả lại lịch sân."
    confirmMessage={`Xóa vĩnh viễn giải “${title}” cùng danh sách đăng ký và trả lại lịch sân? Thao tác này không thể hoàn tác. Giải đã có thông tin chuyển cọc, giao dịch hoặc thỏa thuận tiền thuê sẽ được giữ để đối soát.`} />;
}
