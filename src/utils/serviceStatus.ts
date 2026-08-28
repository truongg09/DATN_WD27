/**
 * Quy trình dịch vụ nhìn từ phía khách.
 *
 * Hệ thống chỉ có sẵn `booking_services.status` là ENUM('unused','used',
 * 'cancelled') và mốc `usedAt` — không thêm cột hay bảng nào. Bốn bước của quy
 * trình được suy ra từ hai trường đó:
 *
 *   'unused'    -> Chờ xác nhận   (lễ tân chưa đánh dấu phục vụ)
 *   'used'      -> Đã xác nhận    (đang tính tiền vào đơn)
 *   'cancelled' -> Đã hủy
 *
 * LƯU Ý VỀ usedAt: cột này KHÔNG phải giờ hẹn sử dụng — backend gán bằng chính
 * thời điểm ghi bản ghi (toàn bộ dữ liệu hiện có đều trùng createdAt), nên chỉ
 * dùng để hiển thị "đã ghi nhận lúc nào", không dùng để chặn quyền hủy.
 *
 * LUẬT HỦY Ở ĐÂY PHẢI KHỚP evaluateCustomerServiceCancel trong
 * backend/services/bookingService.js — sửa một bên thì sửa cả bên kia. Backend
 * mới là nơi chặn thật, phần này chỉ để giao diện không mời khách bấm một nút
 * chắc chắn sẽ báo lỗi.
 */

export type ServiceStage =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "cancelled";

export interface ServiceStageInfo {
  stage: ServiceStage;
  label: string;
  /** Màu cho Tag của Ant Design */
  color: string;
  /** Khách có được tự hủy dòng này không */
  canCancel: boolean;
  /** Câu giải thích khi không được hủy (rỗng nếu được hủy) */
  blockedReason: string;
}

const CLOSED_BOOKING_STATUSES = ["checked_out", "cancelled", "no_show"];

export function getServiceStageInfo(
  charge: { status?: string | null; usedAt?: string | null },
  bookingStatus?: string | null
): ServiceStageInfo {
  const status = String(charge?.status || "used").toLowerCase();

  if (status === "cancelled") {
    return {
      stage: "cancelled",
      label: "Đã hủy",
      color: "default",
      canCancel: false,
      blockedReason: "",
    };
  }

  const bookingClosed = CLOSED_BOOKING_STATUSES.includes(
    String(bookingStatus || "").toLowerCase()
  );

  // Chưa tính tiền, đang chờ lễ tân xác nhận.
  if (status === "unused") {
    return {
      stage: "pending",
      label: "Chờ xác nhận",
      color: "gold",
      canCancel: !bookingClosed,
      blockedReason: bookingClosed
        ? "Đơn đặt phòng đã kết thúc, vui lòng liên hệ lễ tân nếu cần hỗ trợ."
        : "",
    };
  }

  return {
    stage: "confirmed",
    label: "Đã xác nhận",
    color: "green",
    canCancel: !bookingClosed,
    blockedReason: bookingClosed
      ? "Đơn đặt phòng đã kết thúc, vui lòng liên hệ lễ tân nếu cần hỗ trợ."
      : "",
  };
}

/** Định dạng mốc thời gian sử dụng cho bảng dịch vụ của khách. */
export function formatServiceTime(usedAt?: string | null): string {
  if (!usedAt) return "Chưa xác định";
  const value = new Date(usedAt);
  if (Number.isNaN(value.getTime())) return "Chưa xác định";
  return value.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
