import { DeleteAction } from './delete-action';

export function AdminDeleteVenueButton({ id, name }: { id: string; name: string }) {
  return <DeleteAction endpoint={`/api/admin/venues/${id}`} method="DELETE" name={name}
    label="Xóa sân" ariaLabel={`Xóa sân: ${name}`}
    description="Xóa cụm sân và tất cả sân con. Chỉ xóa được cụm chưa có đơn đặt và không còn giải đấu liên quan; lịch sử cần đối soát sẽ được giữ lại."
    successMessage="Đã xóa cụm sân và các sân con." />;
}
