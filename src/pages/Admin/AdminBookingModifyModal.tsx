import React, { useEffect, useState } from "react";
import {
  Modal,
  Form,
  DatePicker,
  Select,
  Button,
  Tag,
  Alert,
  Spin,
  message,
  Card,
  Divider,
} from "antd";
import { PlusOutlined, DeleteOutlined, SwapOutlined, DollarOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import api from "../../services/api";

interface RoomItem {
  key: string | number;
  bookingDetailId?: number | null;
  roomId?: number | null;
  roomTypeId?: number | null;
  adults: number;
  children: number;
  childrenAges: number[];
}

interface PricePreview {
  oldTotalAmount: number;
  newTotalAmount: number;
  priceDifference: number;
  depositAmount: number;
  paidAmount: number;
  newRemainingAmount: number;
  nights: number;
  rooms: any[];
}

interface AdminBookingModifyModalProps {
  open: boolean;
  bookingId: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const childAgeOptions = [
  { value: 4, label: "Dưới 5 tuổi (Miễn phí)" },
  { value: 8, label: "Từ 6 - 11 tuổi (Phụ thu trẻ em)" },
  { value: 12, label: "Trên 12 tuổi (Tính người lớn)" },
];

const readChildrenAges = (value: unknown, children: number): number[] => {
  if (Array.isArray(value)) return value.map(Number).slice(0, children);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(Number).slice(0, children);
    } catch {
      // Booking cũ chưa lưu tuổi trẻ em riêng cho từng phòng.
    }
  }
  return Array.from({ length: children }, () => 8);
};

export const AdminBookingModifyModal: React.FC<AdminBookingModifyModalProps> = ({
  open,
  bookingId,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [roomsList, setRoomsList] = useState<RoomItem[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [availableRoomsList, setAvailableRoomsList] = useState<any[]>([]);
  const [bookingStatus, setBookingStatus] = useState<string>("");
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Load booking details & room types when modal opens
  useEffect(() => {
    if (open && bookingId) {
      loadInitialData();
    } else {
      setPreview(null);
      setRoomsList([]);
      setDateRange(null);
      setBookingStatus("");
    }
  }, [open, bookingId]);

  const loadInitialData = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      // 1. Fetch room types
      const typesRes: any = await api.get("/rooms/types");
      const fetchedTypes = Array.isArray(typesRes) ? typesRes : (typesRes?.data || typesRes?.data?.data || []);
      setRoomTypes(fetchedTypes);

      // 2. Fetch booking info
      const bookingRes: any = await api.get(`/bookings/${bookingId}`);
      const b = bookingRes?.data || bookingRes;

      if (b) {
        setBookingStatus(b.status || b.bookingStatus || "");
        const inDate = dayjs(b.check_in || b.checkIn);
        const outDate = dayjs(b.check_out || b.checkOut);
        setDateRange([inDate, outDate]);

        // Helper to match exact roomTypeId from fetchedTypes by ID or typeName
        const matchTypeId = (item: any) => {
          const rawId = item.roomTypeId || item.room_type_id || b.room_type_id || b.roomTypeId;
          const rawName = item.room_type_name || item.typeName || b.room_type_name;
          const found = fetchedTypes.find(
            (t: any) => Number(t.id) === Number(rawId) || String(t.typeName).toLowerCase() === String(rawName || "").toLowerCase()
          );
          if (found) return found.id;
          if (rawId) return Number(rawId);
          return fetchedTypes[0]?.id || 1;
        };

        // Build initial rooms list from booking_details or fallback
        const rawDetails = Array.isArray(b.details) && b.details.length > 0 ? b.details : [];
        if (rawDetails.length > 0) {
          const mapped = rawDetails.map((d: any, idx: number) => ({
            key: d.bookingDetailId || d.id || `detail_${idx}`,
            bookingDetailId: d.bookingDetailId || d.id || null,
            roomId: d.roomId || d.room_id || null,
            roomTypeId: matchTypeId(d),
            adults: Number(d.adults || 1),
            children: Number(d.children || 0),
            childrenAges: readChildrenAges(d.childrenAges, Number(d.children || 0)),
          }));
          setRoomsList(mapped);
        } else if (Array.isArray(b.booking_rooms) && b.booking_rooms.length > 0) {
          const mapped = b.booking_rooms.map((br: any, idx: number) => ({
            key: br.id || `room_${idx}`,
            bookingDetailId: null,
            roomId: br.id || null,
            roomTypeId: matchTypeId(br),
            adults: 1,
            children: 0,
            childrenAges: [],
          }));
          setRoomsList(mapped);
        } else {
          setRoomsList([
            {
              key: 1,
              bookingDetailId: null,
              roomId: b.room_id || null,
              roomTypeId: matchTypeId(b),
              adults: Number(b.adults || 1),
              children: Number(b.children || 0),
              childrenAges: readChildrenAges(b.childrenAges, Number(b.children || 0)),
            },
          ]);
        }

        // Fetch availability for initial dates
        const initialRooms = rawDetails.length > 0
          ? rawDetails
          : [{ roomId: b.room_id, roomTypeId: matchTypeId(b) }];
        fetchAvailabilityAndPreview(inDate.format("YYYY-MM-DD"), outDate.format("YYYY-MM-DD"), initialRooms);
      }
    } catch (err) {
      console.error("Load initial booking modify error:", err);
      message.error("Lỗi khi tải thông tin đặt phòng");
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch available rooms & price preview whenever dates or roomsList changes
  useEffect(() => {
    if (open && bookingId && dateRange && dateRange[0] && dateRange[1] && roomsList.length > 0) {
      const checkIn = dateRange[0].format("YYYY-MM-DD");
      const checkOut = dateRange[1].format("YYYY-MM-DD");
      fetchAvailabilityAndPreview(checkIn, checkOut, roomsList);
    }
  }, [dateRange, roomsList]);

  const fetchAvailabilityAndPreview = async (checkIn: string, checkOut: string, rooms: RoomItem[]) => {
    if (!bookingId) return;
    setPreviewLoading(true);
    try {
      // 1. Fetch Admin availability (ignoring current booking)
      const availRes: any = await api.post(`/bookings/${bookingId}/admin-check-availability`, {
        checkIn,
        checkOut,
      });
      const availData = availRes?.data || availRes || {};
      setAvailableRoomsList(availData.availableRooms || []);

      // 2. Fetch Price Preview
      const previewRes: any = await api.post(`/bookings/${bookingId}/admin-preview-modify`, {
        checkIn,
        checkOut,
        rooms: rooms.map((r) => ({
          bookingDetailId: r.bookingDetailId || undefined,
          id: r.bookingDetailId || undefined,
          roomId: r.roomId || undefined,
          roomTypeId: r.roomTypeId || undefined,
          adults: r.adults,
          children: r.children,
          childrenAges: r.childrenAges,
        })),
      });
      const previewData = previewRes?.data || previewRes || null;
      setPreview(previewData);
    } catch (err: any) {
      console.error("Preview modify error:", err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAddRoomRow = () => {
    const defaultType = roomTypes[0]?.id || 1;
    setRoomsList((prev) => [
      ...prev,
      {
        key: `new_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        bookingDetailId: null,
        roomId: null,
        roomTypeId: defaultType,
        adults: 2,
        children: 0,
        childrenAges: [],
      },
    ]);
  };

  const handleRemoveRoomRow = (key: string | number) => {
    if (roomsList.length <= 1) {
      message.warning("Đặt phòng phải có ít nhất 1 phòng");
      return;
    }
    setRoomsList((prev) => prev.filter((r) => r.key !== key));
  };

  const handleUpdateRoomField = (key: string | number, field: keyof RoomItem, val: any) => {
    setRoomsList((prev) =>
      prev.map((item) => {
        if (item.key === key) {
          const updated = { ...item, [field]: val };
          if (field === "children") {
            const count = Math.max(0, Number(val || 0));
            const newAges = [...(item.childrenAges || [])];
            if (count > newAges.length) {
              while (newAges.length < count) newAges.push(8);
            } else {
              newAges.length = count;
            }
            updated.childrenAges = newAges;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleSubmitModify = async () => {
    if (!bookingId || !dateRange) return;

    const selectedRoomIds = roomsList.map((r) => r.roomId).filter(Boolean);
    const hasDuplicates = new Set(selectedRoomIds).size !== selectedRoomIds.length;
    if (hasDuplicates) {
      message.error("Không được chọn trùng 1 phòng cụ thể cho nhiều vị trí!");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        checkIn: dateRange[0].format("YYYY-MM-DD"),
        checkOut: dateRange[1].format("YYYY-MM-DD"),
        rooms: roomsList.map((r) => ({
          bookingDetailId: r.bookingDetailId || undefined,
          id: r.bookingDetailId || undefined,
          roomId: r.roomId || undefined,
          roomTypeId: r.roomTypeId || undefined,
          adults: r.adults,
          children: r.children,
          childrenAges: r.childrenAges,
        })),
      };

      const res = await api.patch(`/bookings/${bookingId}/admin-modify`, payload);
      message.success(res.data?.message || "Cập nhật đặt phòng thành công!");
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Lỗi khi cập nhật đặt phòng";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num || 0);
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18 }}>
          <SwapOutlined style={{ color: "#1890ff" }} />
          <span>Quản lý & Chỉnh sửa Booking #{bookingId}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={850}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Hủy bỏ
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          disabled={loading || !preview}
          onClick={handleSubmitModify}
          size="large"
          style={{ background: "#1890ff" }}
        >
          Xác nhận cập nhật
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Section 1: Dates selection */}
          <Card title="1. Thời gian lưu trú" size="small" style={{ background: "#f8fafc" }}>
            <Form layout="vertical">
              <Form.Item label="Ngày nhận phòng & Trả phòng (Check-in / Check-out)" required style={{ marginBottom: 0 }}>
                <DatePicker.RangePicker
                  style={{ width: "100%" }}
                  size="large"
                  format="DD/MM/YYYY"
                  value={dateRange}
                  disabledDate={(current) => current && current < dayjs().startOf("day")}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setDateRange([dates[0], dates[1]]);
                    }
                  }}
                />
              </Form.Item>
            </Form>
          </Card>

          {/* Section 2: Rooms & Guests selection */}
          <Card
            title={
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>2. Danh sách phòng & Khách ở</span>
                {bookingStatus !== "checked_in" && (
                  <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRoomRow}>
                    Thêm phòng
                  </Button>
                )}
              </div>
            }
            size="small"
          >
            {bookingStatus === "checked_in" && (
              <Alert
                type="info"
                showIcon
                message="Đơn đặt phòng đã nhận phòng (checked-in). Không thể đổi gán phòng vật lý hoặc thêm/bớt số lượng phòng tại đây. Vui lòng sử dụng chức năng 'Chuyển phòng' nếu cần đổi phòng cho khách."
                style={{ marginBottom: 12 }}
              />
            )}

            {roomsList.map((room, idx) => {
              // Collect roomIds selected in OTHER rows
              const selectedInOtherRows = roomsList
                .filter((r) => r.key !== room.key && r.roomId)
                .map((r) => Number(r.roomId));

              // Filter available specific room numbers matching selected roomTypeId and not used elsewhere
              const availableRoomsForType = availableRoomsList.filter((r) => {
                const isCorrectType = !room.roomTypeId || Number(r.roomTypeId) === Number(room.roomTypeId) || Number(r.id) === Number(room.roomId);
                const isNotUsedInOtherRow = !selectedInOtherRows.includes(Number(r.id));
                return isCorrectType && isNotUsedInOtherRow;
              });

              return (
                <div
                  key={room.key}
                  style={{
                    padding: 12,
                    marginBottom: 12,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontWeight: 600 }}>
                    <span>Phòng #{idx + 1}</span>
                    {roomsList.length > 1 && bookingStatus !== "checked_in" && (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveRoomRow(room.key)}
                      >
                        Xóa
                      </Button>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 120px", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, color: "#64748b" }}>Hạng phòng</label>
                      <Select
                        style={{ width: "100%" }}
                        placeholder="Chọn hạng phòng"
                        disabled={bookingStatus === "checked_in"}
                        value={room.roomTypeId || undefined}
                        options={roomTypes.map((t) => ({ value: t.id, label: `${t.typeName} (${formatVND(t.defaultPrice)}/đêm)` }))}
                        onChange={(val) => {
                          handleUpdateRoomField(room.key, "roomTypeId", val);
                          handleUpdateRoomField(room.key, "roomId", null);
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#64748b" }}>Số phòng cụ thể</label>
                      <Select
                        style={{ width: "100%" }}
                        placeholder="Tự động hoặc Chọn phòng"
                        allowClear
                        disabled={bookingStatus === "checked_in"}
                        value={room.roomId || undefined}
                        options={availableRoomsForType.map((r) => ({
                          value: r.id,
                          label: `Phòng ${r.roomNumber} (Tầng ${r.floor})`,
                        }))}
                        onChange={(val) => handleUpdateRoomField(room.key, "roomId", val || null)}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#64748b" }}>Người lớn</label>
                      <Select
                        style={{ width: "100%" }}
                        value={room.adults}
                        onChange={(val) => handleUpdateRoomField(room.key, "adults", val)}
                        options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} người lớn` }))}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, color: "#64748b" }}>Trẻ em</label>
                      <Select
                        style={{ width: "100%" }}
                        value={room.children}
                        onChange={(val) => handleUpdateRoomField(room.key, "children", val)}
                        options={[0, 1, 2, 3, 4].map((n) => ({ value: n, label: `${n} trẻ em` }))}
                      />
                    </div>
                  </div>

                  {/* Child ages selection if children > 0 */}
                  {room.children > 0 && (
                    <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", background: "#f8fafc", padding: 8, borderRadius: 6 }}>
                      {Array.from({ length: room.children }).map((_, childIdx) => (
                        <div key={childIdx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 12, color: "#475467" }}>Độ tuổi trẻ {childIdx + 1}:</span>
                          <Select
                            style={{ width: 180 }}
                            value={room.childrenAges[childIdx] ?? 8}
                            options={childAgeOptions}
                            onChange={(val) => {
                              const newAges = [...room.childrenAges];
                              newAges[childIdx] = val;
                              handleUpdateRoomField(room.key, "childrenAges", newAges);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>

          {/* Section 3: Real-time Price Difference Breakdown */}
          <Card
            title={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <DollarOutlined style={{ color: "#52c41a" }} />
                <span>3. Tóm tắt Chênh lệch giá & Hóa đơn</span>
              </div>
            }
            size="small"
            style={{ background: "#f6ffed", borderColor: "#b7eb8f" }}
          >
            <Spin spinning={previewLoading}>
              {preview ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span>Tổng tiền bill cũ:</span>
                    <strong>{formatVND(preview.oldTotalAmount)}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span>Tổng tiền bill mới:</span>
                    <strong style={{ color: "#1890ff", fontSize: 16 }}>{formatVND(preview.newTotalAmount)}</strong>
                  </div>

                  <Divider style={{ margin: "6px 0" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 15 }}>
                    <span style={{ fontWeight: 600 }}>Chênh lệch giá:</span>
                    <Tag
                      color={preview.priceDifference > 0 ? "error" : preview.priceDifference < 0 ? "success" : "default"}
                      style={{ fontSize: 15, padding: "4px 12px", fontWeight: 700 }}
                    >
                      {preview.priceDifference > 0 ? `+${formatVND(preview.priceDifference)} (Thu thêm)` : preview.priceDifference < 0 ? `${formatVND(preview.priceDifference)} (Hoàn tiền)` : "0 VNĐ (Không đổi)"}
                    </Tag>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475467", marginTop: 4 }}>
                    <span>Tiền cọc đã trả (Giữ nguyên):</span>
                    <span>{formatVND(preview.depositAmount + preview.paidAmount)}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "#1e293b", marginTop: 2 }}>
                    <span>Còn lại thu khi Checkout:</span>
                    <span style={{ color: "#d97706" }}>{formatVND(preview.newRemainingAmount)}</span>
                  </div>

                  <Alert
                    type="info"
                    showIcon
                    message="Quy tắc tiền cọc & Chênh lệch:"
                    description="Không yêu cầu thu thêm tiền cọc ngay lập tức. Số tiền chênh lệch sẽ tự động được hạch toán vào công nợ cuối để thu hoặc hoàn tiền cho khách tại thời điểm Checkout."
                    style={{ marginTop: 8 }}
                  />
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 12, color: "#8c8c8c" }}>Đang tính toán bảng giá...</div>
              )}
            </Spin>
          </Card>
        </div>
      </Spin>
    </Modal>
  );
};

export default AdminBookingModifyModal;
