import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { message } from "antd";
import EmptyState from "../../components/Common/EmptyState";
import {
  fetchCustomerDetail,
  fetchCustomerBookings,
  fetchCustomerPayments,
  fetchCustomerReviews,
} from "../../services/customerService";

// Tông màu thương hiệu — đồng bộ với trang Quản lý khách hàng
const brand = {
  primary: "#a78362",
  primaryDark: "#8c6d4a",
  accent: "#c9a063",
  success: "#3f8f5f",
  successBg: "#eaf3ec",
  danger: "#bb4a3c",
  dangerBg: "#fbece9",
  warning: "#9c7a2e",
  warningBg: "#faf3df",
  page: "#f8f6f2",
  border: "#ece6db",
  textPrimary: "#2b2420",
  textSecondary: "#8d8478",
};

type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

const toneStyles: Record<StatusTone, { color: string; bg: string }> = {
  success: { color: brand.success, bg: brand.successBg },
  danger: { color: brand.danger, bg: brand.dangerBg },
  warning: { color: brand.warning, bg: brand.warningBg },
  info: { color: brand.primaryDark, bg: "#f4ece1" },
  neutral: { color: brand.textSecondary, bg: "#f1efe9" },
};

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  const palette = toneStyles[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: palette.color,
        background: palette.bg,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: palette.color,
        }}
      />
      {label}
    </span>
  );
}

function bookingStatusMeta(status: string): {
  label: string;
  tone: StatusTone;
} {
  switch (status) {
    case "confirmed":
      return { label: "Đã xác nhận", tone: "success" };
    case "checked_in":
    case "checkin":
      return { label: "Đang lưu trú", tone: "info" };
    case "checked_out":
    case "checkout":
      return { label: "Đã trả phòng", tone: "info" };
    case "no_show":
      return { label: "Khách không đến", tone: "danger" };
    case "pending":
      return { label: "Chờ xác nhận", tone: "warning" };
    case "cancelled":
      return { label: "Đã hủy", tone: "danger" };
    default:
      return { label: status, tone: "neutral" };
  }
}

function paymentStatusMeta(status: string): {
  label: string;
  tone: StatusTone;
} {
  return status === "paid"
    ? { label: "Đã thanh toán", tone: "success" }
    : { label: "Chưa thanh toán", tone: "warning" };
}

const btnBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 38,
  padding: "0 18px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  lineHeight: 1,
  border: `1px solid ${brand.border}`,
  background: "#fff",
  color: brand.textPrimary,
  cursor: "pointer",
  boxShadow: "none",
  transition: "background 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s",
};

// Style override khi nút bị disabled tĩnh (vd. nút phân trang ở đầu/cuối danh sách)
const btnDisabledStyle: CSSProperties = {
  cursor: "not-allowed",
  color: brand.textSecondary,
  borderColor: brand.border,
  background: "#fbf9f6",
};

// Style nút tab — nền nhạt khi active, đồng bộ tinh thần Segmented bên trang danh sách
const tabBtnStyle = (active: boolean): CSSProperties => ({
  height: 40,
  padding: "0 18px",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: "10px 10px 0 0",
  border: "none",
  cursor: "pointer",
  background: active ? "#fff" : "transparent",
  color: active ? brand.primaryDark : brand.textSecondary,
  borderBottom: active ? `3px solid ${brand.primary}` : "3px solid transparent",
  transition: "background 0.2s, color 0.2s",
});

const fieldLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 12,
  fontWeight: 600,
  color: brand.textSecondary,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const thStyle = (
  align: "left" | "right" | "center" = "left",
): CSSProperties => ({
  textAlign: align,
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 600,
  color: brand.textSecondary,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  borderBottom: `1px solid ${brand.border}`,
  background: "#fbf9f6",
});

const tdStyle = (
  align: "left" | "right" | "center" = "left",
): CSSProperties => ({
  textAlign: align,
  padding: "12px 14px",
  fontSize: 14,
  color: brand.textPrimary,
  borderBottom: `1px solid ${brand.border}`,
});

type CustomerDetail = {
  id: number;
  accountId: number;
  fullName: string;
  email: string;
  phone: string;
  gender: string | null;
  dateOfBirth: string | null;
  citizenId: string | null;
  nationality: string | null;
  address: string;
  status: "active" | "locked";
  registeredAt: string;
  totalBookings: number;
  totalSpent: number;
};

type Booking = {
  id: number;
  bookingCode: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  bookingStatus: string;
  roomType: string;
};

type Payment = {
  id: number;
  bookingCode: string;
  paidAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentDate: string;
};

type Review = {
  id: number;
  bookingCode: string;
  roomType: string;
  rating: number;
  comment: string;
  createdAt: string;
};

function AdminCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const customerId = id ? parseInt(id) : null;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "bookings" | "payments" | "reviews"
  >("bookings");
  const [bookingPage, setBookingPage] = useState(0);
  const [bookingTotal, setBookingTotal] = useState(0);

  const bookingPageSize = 10;

  useEffect(() => {
    if (!customerId) {
      setError("Invalid customer ID");
      setLoading(false);
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        const customerJson = await fetchCustomerDetail(customerId);
        if (!customerJson.ok) throw new Error(customerJson.error);
        setCustomer(customerJson.data);

        const bookingsJson = await fetchCustomerBookings(customerId, 0, bookingPageSize);
        if (!bookingsJson.ok) throw new Error(bookingsJson.error);
        setBookings(bookingsJson.data);
        setBookingTotal(bookingsJson.total);

        const paymentsJson = await fetchCustomerPayments(customerId);
        if (!paymentsJson.ok) throw new Error(paymentsJson.error);
        setPayments(paymentsJson.data);

        const reviewsJson = await fetchCustomerReviews(customerId);
        if (!reviewsJson.ok) throw new Error(reviewsJson.error);
        setReviews(reviewsJson.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi không xác định");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [customerId]);

  const handleBookingPageChange = async (page: number) => {
    if (!customerId) return;

    try {
      const json = await fetchCustomerBookings(customerId, page, bookingPageSize);
      if (!json.ok) throw new Error(json.error);
      setBookings(json.data);
      setBookingPage(page);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Không xác định");
    }
  };

  if (loading) {
    return (
      <div className="ml-admin-page" style={{ background: brand.page }}>
        <p style={{ color: brand.textSecondary }}>Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="ml-admin-page" style={{ background: brand.page }}>
        <EmptyState
          title="Không thể tải thông tin"
          message={error || "Khách hàng không tồn tại"}
          actionLabel="Quay lại"
          actionTo="/admin/customers"
        />
      </div>
    );
  }

  const bookingTotalPages = Math.ceil(bookingTotal / bookingPageSize);
  const hasNoPreviousPage = bookingPage === 0;
  const hasNoNextPage = bookingPage >= bookingTotalPages - 1;

  return (
    <div className="ml-admin-page" style={{ background: brand.page }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: brand.textPrimary,
            }}
          >
            {customer.fullName}
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              color: brand.textSecondary,
              fontSize: 14,
            }}
          >
            Chi tiết thông tin khách hàng
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="ml-btn"
            style={btnBase}
            onClick={() => navigate("/admin/customers")}
          >
            ← Quay lại
          </button>
        </div>
      </div>

      {/* Personal Info Section */}
      <div
        style={{
          backgroundColor: "#fff",
          border: `1px solid ${brand.border}`,
          padding: 24,
          borderRadius: 12,
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 16,
            fontSize: 18,
            fontWeight: 700,
            color: brand.textPrimary,
          }}
        >
          Thông tin cá nhân
        </h2>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <div>
            <strong style={fieldLabelStyle}>Họ tên</strong>
            <p style={{ margin: 0, color: brand.textPrimary }}>
              {customer.fullName}
            </p>
          </div>

          <div>
            <strong style={fieldLabelStyle}>Email</strong>
            <p style={{ margin: 0, color: brand.textPrimary }}>
              {customer.email}
            </p>
          </div>

          <div>
            <strong style={fieldLabelStyle}>Số điện thoại</strong>
            <p style={{ margin: 0, color: brand.textPrimary }}>
              {customer.phone}
            </p>
          </div>

          <div>
            <strong style={fieldLabelStyle}>Địa chỉ</strong>
            <p style={{ margin: 0, color: brand.textPrimary }}>
              {customer.address || "—"}
            </p>
          </div>

          <div>
            <strong style={fieldLabelStyle}>Ngày đăng ký</strong>
            <p style={{ margin: 0, color: brand.textPrimary }}>
              {new Date(customer.registeredAt).toLocaleDateString("vi-VN")}
            </p>
          </div>

          <div>
            <strong style={fieldLabelStyle}>Trạng thái</strong>
            <p style={{ margin: 0 }}>
              <StatusPill
                label={customer.status === "active" ? "Hoạt động" : "Đã khóa"}
                tone={customer.status === "active" ? "success" : "danger"}
              />
            </p>
          </div>

          <div>
            <strong style={fieldLabelStyle}>Tổng booking</strong>
            <p
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: brand.primary,
              }}
            >
              {customer.totalBookings}
            </p>
          </div>

          <div>
            <strong style={fieldLabelStyle}>Tổng chi tiêu</strong>
            <p
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: brand.primary,
              }}
            >
              {customer.totalSpent.toLocaleString("vi-VN")} VND
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            borderBottom: `1px solid ${brand.border}`,
            marginBottom: 16,
          }}
        >
          <button
            onClick={() => setActiveTab("bookings")}
            style={tabBtnStyle(activeTab === "bookings")}
          >
            Lịch sử đặt phòng ({customer.totalBookings})
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            style={tabBtnStyle(activeTab === "payments")}
          >
            Lịch sử thanh toán ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            style={tabBtnStyle(activeTab === "reviews")}
          >
            Đánh giá ({reviews.length})
          </button>
        </div>

        {/* Tab: Bookings */}
        {activeTab === "bookings" && (
          <div>
            {bookings.length === 0 ? (
              <EmptyState
                title="Chưa có đặt phòng"
                message="Khách hàng chưa thực hiện booking nào."
              />
            ) : (
              <>
                <div
                  style={{
                    overflowX: "auto",
                    marginBottom: 16,
                    background: "#fff",
                    border: `1px solid ${brand.border}`,
                    borderRadius: 12,
                  }}
                >
                  <table
                    className="ml-table"
                    style={{ width: "100%", borderCollapse: "collapse" }}
                  >
                    <thead>
                      <tr>
                        <th style={thStyle("left")}>Mã booking</th>
                        <th style={thStyle("left")}>Loại phòng</th>
                        <th style={thStyle("left")}>Check-in</th>
                        <th style={thStyle("left")}>Check-out</th>
                        <th style={thStyle("right")}>Tổng tiền</th>
                        <th style={thStyle("center")}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => {
                        const meta = bookingStatusMeta(booking.bookingStatus);
                        return (
                          <tr key={booking.id}>
                            <td style={{ ...tdStyle("left"), fontWeight: 600 }}>
                              {booking.bookingCode}
                            </td>
                            <td style={tdStyle("left")}>
                              {booking.roomType || "—"}
                            </td>
                            <td style={tdStyle("left")}>
                              {new Date(booking.checkInDate).toLocaleDateString(
                                "vi-VN",
                              )}
                            </td>
                            <td style={tdStyle("left")}>
                              {new Date(
                                booking.checkOutDate,
                              ).toLocaleDateString("vi-VN")}
                            </td>
                            <td style={tdStyle("right")}>
                              {booking.totalAmount.toLocaleString("vi-VN")} VND
                            </td>
                            <td style={tdStyle("center")}>
                              <StatusPill label={meta.label} tone={meta.tone} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 14, color: brand.textSecondary }}>
                    Hiển thị {bookingPage * bookingPageSize + 1} đến{" "}
                    {Math.min(
                      (bookingPage + 1) * bookingPageSize,
                      bookingTotal,
                    )}{" "}
                    trong {bookingTotal}
                  </div>

                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <button
                      onClick={() => handleBookingPageChange(bookingPage - 1)}
                      disabled={hasNoPreviousPage}
                      style={
                        hasNoPreviousPage
                          ? { ...btnBase, ...btnDisabledStyle }
                          : btnBase
                      }
                    >
                      ← Trước
                    </button>

                    <span
                      style={{
                        padding: "0 12px",
                        fontSize: 14,
                        color: brand.textSecondary,
                      }}
                    >
                      Trang {bookingPage + 1} / {Math.max(1, bookingTotalPages)}
                    </span>

                    <button
                      onClick={() => handleBookingPageChange(bookingPage + 1)}
                      disabled={hasNoNextPage}
                      style={
                        hasNoNextPage
                          ? { ...btnBase, ...btnDisabledStyle }
                          : btnBase
                      }
                    >
                      Tiếp →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: Payments */}
        {activeTab === "payments" && (
          <div>
            {payments.length === 0 ? (
              <EmptyState
                title="Chưa có thanh toán"
                message="Không có lịch sử thanh toán."
              />
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  background: "#fff",
                  border: `1px solid ${brand.border}`,
                  borderRadius: 12,
                }}
              >
                <table
                  className="ml-table"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle("left")}>Mã booking</th>
                      <th style={thStyle("right")}>Số tiền</th>
                      <th style={thStyle("left")}>Phương thức</th>
                      <th style={thStyle("center")}>Trạng thái</th>
                      <th style={thStyle("left")}>Ngày thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => {
                      const meta = paymentStatusMeta(payment.paymentStatus);
                      return (
                        <tr key={payment.id}>
                          <td style={{ ...tdStyle("left"), fontWeight: 600 }}>
                            {payment.bookingCode}
                          </td>
                          <td style={tdStyle("right")}>
                            {payment.paidAmount.toLocaleString("vi-VN")} VND
                          </td>
                          <td style={tdStyle("left")}>
                            {payment.paymentMethod}
                          </td>
                          <td style={tdStyle("center")}>
                            <StatusPill label={meta.label} tone={meta.tone} />
                          </td>
                          <td style={tdStyle("left")}>
                            {new Date(payment.paymentDate).toLocaleDateString(
                              "vi-VN",
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Reviews */}
        {activeTab === "reviews" && (
          <div>
            {reviews.length === 0 ? (
              <EmptyState
                title="Chưa có đánh giá"
                message="Khách hàng chưa để lại đánh giá nào."
              />
            ) : (
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}
              >
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    style={{
                      border: `1px solid ${brand.border}`,
                      borderRadius: 12,
                      padding: 16,
                      backgroundColor: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <strong style={{ color: brand.textPrimary }}>
                          {review.roomType}
                        </strong>
                        <span
                          style={{
                            marginLeft: 12,
                            color: brand.textSecondary,
                            fontSize: 13,
                          }}
                        >
                          Booking: {review.bookingCode}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: brand.accent }}>
                        {"⭐".repeat(review.rating)}
                      </div>
                    </div>
                    <p
                      style={{ margin: "8px 0 0 0", color: brand.textPrimary }}
                    >
                      {review.comment}
                    </p>
                    <p
                      style={{
                        margin: "8px 0 0 0",
                        fontSize: 12,
                        color: brand.textSecondary,
                      }}
                    >
                      {new Date(review.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminCustomerDetail;
