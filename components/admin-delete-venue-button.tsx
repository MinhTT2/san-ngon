import { DeleteAction } from './delete-action';

export function AdminDeleteVenueButton({ id, name }: { id: string; name: string }) {
  return <DeleteAction endpoint={`/api/admin/venues/${id}`} method="DELETE" name={name}
    label="Xóa sân" ariaLabel={`Xóa sân: ${name}`}
    description="Admin được xóa vĩnh viễn cụm sân, tất cả sân con, đơn đặt và giải đấu liên quan, kể cả đã có thanh toán. Sổ tiền vào và yêu cầu hỗ trợ được giữ để đối soát. Thao tác này không tự hoàn tiền; hãy xử lý các đơn sắp tới và khoản cần hoàn trước khi xóa."
    successMessage="Đã xóa cụm sân và các sân con." />;
}
