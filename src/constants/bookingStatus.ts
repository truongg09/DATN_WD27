// Nhãn trạng thái đặt phòng dùng chung cho mọi màn hình phía khách.
//
// Trước đây mỗi trang tự khai một bảng riêng và chỉ có trang chi tiết đặt phòng
// biết tới 'no_show'. Ba trang còn lại rơi vào nhánh mặc định nên đơn khách
// không đến vẫn hiện thẻ vàng "Chờ xác nhận", khiến khách tưởng đơn còn hiệu lực.
//
// `color` dùng cho <Tag> của antd, `className` dùng cho các thẻ trạng thái tự
// viết bằng CSS trong trang đặt phòng.
export type BookingStatusMeta = {
  label: string;
  color: string;
  className: string;
};

export const BOOKING_STATUS_META: Record<string, BookingStatusMeta> = {
  pending: { label: 'Chờ xác nhận', color: 'gold', className: 'pending' },
  confirmed: { label: 'Đã xác nhận', color: 'blue', className: 'confirmed' },
  checked_in: { label: 'Đang ở', color: 'green', className: 'checked-in' },
  checked_out: { label: 'Đã trả phòng', color: 'default', className: 'checked-out' },
  cancelled: { label: 'Đã hủy', color: 'red', className: 'cancelled' },
  no_show: {
    label: 'Khách không đến (No-show)',
    color: 'volcano',
    className: 'no-show',
  },
};

// Trạng thái lạ thì hiện đúng chuỗi máy chủ trả về thay vì im lặng coi như
// "Chờ xác nhận" — sai lệch kiểu đó rất khó phát hiện khi vận hành.
export const getBookingStatusMeta = (status?: string | null): BookingStatusMeta => {
  const key = String(status || '').toLowerCase();
  return (
    BOOKING_STATUS_META[key] || {
      label: status ? String(status) : 'Không rõ',
      color: 'default',
      className: 'unknown',
    }
  );
};
