import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Spin, message, Divider, Rate, Input, Space, Upload, Modal, Select, Table, Row, Col, Alert } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { FileTextOutlined, CreditCardOutlined, PlusOutlined, StarOutlined, EditOutlined, UserOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBookingDetail, updateRequestedArrivalTime } from '../../services/bookingService';
import { getPaymentByBookingId } from '../../services/paymentService';
import { getInvoiceByBookingId } from '../../services/invoiceService';
import { createReview, getReviews, updateReview } from '../../services/reviewService';
import api from '../../services/api';
import type { Payment } from '../../types/payment';
import type { Invoice } from '../../types/invoice';
import { BOOKING_STATUS_META } from '../../constants/bookingStatus';
import './BookingDetail.css';

const MAX_REVIEW_IMAGES = 5;
const MAX_IMAGE_SIZE_MB = 5;

// Upload 1 ảnh lên server ngay khi người dùng chọn, dùng chung API
// POST /upload/review-images (multer, trả về { data: { urls: string[] } }).
const uploadReviewImage: UploadProps['customRequest'] = async (options) => {
  const { file, onSuccess, onError } = options;
  try {
    const formData = new FormData();
    formData.append('images', file as File);
    const res = await api.post('/upload/review-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const body = (res as unknown as { data?: unknown })?.data ?? res;
    const url =
      (body as { data?: { urls?: string[] } })?.data?.urls?.[0] ??
      (body as { urls?: string[] })?.urls?.[0];
    if (!url) throw new Error('Không nhận được URL ảnh');
    onSuccess?.({ url }, new XMLHttpRequest());
  } catch (error) {
    console.error('Upload review image error:', error);
    message.error('Tải ảnh lên thất bại, vui lòng thử lại');
    onError?.(error as Error);
  }
};
    // Never trust a gateway query parameter alone. The success notice is shown
    // only after the backend has verified the callback and updated the payment.
const beforeUploadReviewImage = (file: File) => {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    message.error('Chỉ được chọn file ảnh');
    return Upload.LIST_IGNORE;
  }
  const isUnderLimit = file.size / 1024 / 1024 < MAX_IMAGE_SIZE_MB;
  if (!isUnderLimit) {
    message.error(`Ảnh phải nhỏ hơn ${MAX_IMAGE_SIZE_MB}MB`);
    return Upload.LIST_IGNORE;
  }
  return true;
};

const imageUrlsToFileList = (urls?: string[]): UploadFile[] =>
  (urls || []).map((url, index) => ({
    uid: `existing-${index}-${url}`,
    name: url.split('/').pop() || `image-${index}`,
    status: 'done',
    url,
  }));

const fileListToImageUrls = (fileList: UploadFile[]): string[] =>
  fileList
    .map((file) => file.url || (file.response as { url?: string } | undefined)?.url)
    .filter((url): url is string => Boolean(url));

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const formatDate = (date: string | Date) => {
  return dayjs(date).format('DD/MM/YYYY');
};

// Dùng chung bảng nhãn ở constants/bookingStatus cho khớp các trang còn lại.
const bookingStatusMap = BOOKING_STATUS_META;

const getBookingDisplayTag = (b: Record<string, unknown> | null) => {
  if (!b) return { label: 'N/A', color: 'default' };
  const normStatus = String(b.status || 'pending').toLowerCase();
  if (
    ['pending', 'confirmed'].includes(normStatus) &&
    !b.actual_check_in_time &&
    b.check_in
  ) {
    const checkInStr = dayjs(String(b.check_in)).format('YYYY-MM-DD');
    const reqTime = String(b.requested_check_in_time || '14:00:00');
    const requestedDateTime = dayjs(`${checkInStr} ${reqTime}`);
    const lateDeadline = requestedDateTime.add(6, 'hour');
    const now = dayjs();

    if (now.isAfter(requestedDateTime) && (now.isBefore(lateDeadline) || now.isSame(lateDeadline))) {
      return { label: 'Check-in muộn', color: 'orange' };
    }
  }
  return bookingStatusMap[normStatus] || { label: normStatus, color: 'default' };
};

const paymentStatusMap: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: 'orange' },
  deposit_paid: { label: 'Đã đặt cọc', color: 'blue' },
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

// Nhãn/màu cho trạng thái kiểm duyệt đánh giá (review) - khác trạng thái booking ở trên.
const reviewStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Đang chờ duyệt', color: 'gold' },
  hidden: { label: 'Bị ẩn/từ chối', color: 'red' },
};

const BookingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = Number(id);
  const isValidBookingId = Number.isInteger(bookingId) && bookingId > 0;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const handledPaymentCallbackRef = useRef('');
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [reviewImageFileList, setReviewImageFileList] = useState<UploadFile[]>([]);
  const [existingReview, setExistingReview] = useState<{
    id: number;
    rating: number;
    comment?: string;
    status?: string;
    adminReply?: string | null;
    hideReason?: string | null;
    images?: string[];
  } | null>(null);

  const [isArrivalTimeModalOpen, setIsArrivalTimeModalOpen] = useState(false);
  const [newArrivalTime, setNewArrivalTime] = useState('14:00');
  const [arrivalNotes, setArrivalNotes] = useState('');
  const [updatingArrivalTime, setUpdatingArrivalTime] = useState(false);

  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestList, setGuestList] = useState<Array<{ fullName: string; identityNumber: string; phone?: string; note?: string }>>([]);
  const [savingGuests, setSavingGuests] = useState(false);

  const handleUpdateArrivalTime = async () => {
    if (!newArrivalTime) {
      message.warning('Vui lòng chọn giờ đến dự kiến mới');
      return;
    }
    setUpdatingArrivalTime(true);
    try {
      let timeStr = newArrivalTime;
      let dayOffset = 0;
      if (timeStr.includes('+1')) {
        timeStr = timeStr.replace('+1', '');
        dayOffset = 1;
      }
      await updateRequestedArrivalTime(bookingId, timeStr, dayOffset, arrivalNotes.trim());
      message.success('Đã cập nhật giờ đến dự kiến thành công!');
      setIsArrivalTimeModalOpen(false);
      setArrivalNotes('');
      const res = await getBookingDetail(bookingId);
      setBooking(res.data as Record<string, unknown>);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể cập nhật giờ đến');
    } finally {
      setUpdatingArrivalTime(false);
    }
  };

  const openGuestModal = () => {
    if (bookingGuests.length > 0) {
      setGuestList(
        bookingGuests.map((g) => ({
          fullName: String(g.fullName || ''),
          identityNumber: String(g.identityNumber || ''),
          phone: String(g.phone || ''),
          note: String(g.note || ''),
        }))
      );
    } else {
      setGuestList([
        {
          fullName: String(booking?.guest_name || booking?.customer_name || ''),
          identityNumber: '',
          phone: String(booking?.guest_phone || booking?.customer_phone || ''),
          note: '',
        },
      ]);
    }
    setIsGuestModalOpen(true);
  };

  const handleSaveGuests = async () => {
    for (let i = 0; i < guestList.length; i++) {
      const g = guestList[i];
      if (!g.fullName.trim()) {
        message.warning(`Vui lòng nhập họ tên khách thứ ${i + 1}`);
        return;
      }
      const idNum = String(g.identityNumber || '').trim();
      if (idNum && !/^\d{12}$/.test(idNum)) {
        message.warning(`Số CCCD của khách "${g.fullName}" phải gồm đúng 12 chữ số`);
        return;
      }
    }

    setSavingGuests(true);
    try {
      await api.post(`/bookings/${bookingId}/guests`, {
        guests: guestList.map((g) => ({
          fullName: g.fullName.trim(),
          identityNumber: g.identityNumber ? g.identityNumber.trim() : null,
          phone: g.phone ? g.phone.trim() : null,
          note: g.note ? g.note.trim() : null,
        })),
      });
      message.success('Đã cập nhật thông tin khách lưu trú thành công!');
      setIsGuestModalOpen(false);
      const res = await getBookingDetail(bookingId);
      setBooking(res.data as Record<string, unknown>);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể lưu thông tin khách lưu trú');
    } finally {
      setSavingGuests(false);
    }
  };

  useEffect(() => {
    if (!isValidBookingId) {
      message.error('Mã đặt phòng không hợp lệ');
      navigate('/booking/history');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const bookingRes = await getBookingDetail(bookingId);
        setBooking(bookingRes.data as Record<string, unknown>);

        try {
          const paymentRes = await getPaymentByBookingId(bookingId);
          setPayment(paymentRes.data);

          if (paymentRes.data.paymentStatus === 'paid') {
            try {
              const invoiceRes = await getInvoiceByBookingId(bookingId);
              setInvoice(invoiceRes.data);
            } catch {
              setInvoice(null);
            }
          }
        } catch {
          setPayment(null);
        }
      } catch {
        message.error('Không tìm thấy đặt phòng');
        navigate('/booking/history');
      } finally {
        setLoading(false);
      }

      try {
        const reviewsRes = await getReviews({ bookingIds: String(bookingId) });
        const rows =
          ((reviewsRes as {
            data?: {
              id: number;
              bookingId: number;
              rating: number;
              comment?: string;
              status?: string;
              adminReply?: string | null;
              hideReason?: string | null;
              images?: string[];
            }[];
          }).data) || [];
        const mine = rows.find((row) => Number(row.bookingId) === bookingId);
        setExistingReview(
          mine
            ? {
                id: mine.id,
                rating: mine.rating,
                comment: mine.comment,
                status: mine.status,
                adminReply: mine.adminReply,
                hideReason: mine.hideReason,
                images: mine.images,
              }
            : null,
        );
      } catch {
        // Không chặn trang nếu tải đánh giá thất bại
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [bookingId, isValidBookingId, navigate]);

  useEffect(() => {
    const gateway = searchParams.get('gateway');
    const paymentResult = searchParams.get('payment');
    const callbackStatus = searchParams.get('status');
    if (!paymentResult || !payment) return;

    const callbackKey = `${gateway || ''}:${paymentResult || ''}:${callbackStatus || ''}`;
    if (handledPaymentCallbackRef.current === callbackKey) return;
    handledPaymentCallbackRef.current = callbackKey;

    const gatewayReportedSuccess = paymentResult === 'success';
    const isGatewayReturn = gatewayReportedSuccess || gateway === 'zalopay';
    const isSettled = payment?.paymentStatus === 'paid' || payment?.paymentStatus === 'deposit_paid';
    const isCurrentZalopayPaymentRecorded = gateway !== 'zalopay' || Boolean(payment?.paymentDate);
    const callbackMatchesPayment =
      callbackStatus === 'paid'
        ? payment?.paymentStatus === 'paid'
        : callbackStatus === 'deposit_paid'
          ? payment?.paymentStatus === 'deposit_paid'
          : false;


    if (isGatewayReturn && isSettled && callbackMatchesPayment && isCurrentZalopayPaymentRecorded) {
      const isFullyPaid = payment?.paymentStatus === 'paid';
      message.success({
        content: isFullyPaid
          ? 'Thanh toán thành công! Đơn đặt phòng đã được thanh toán đầy đủ.'
          : `Đặt cọc thành công! Hệ thống đã ghi nhận khoản cọc. Số tiền còn lại: ${formatPrice(payment?.remainingAmount ?? 0)}.`,
        duration: 6,
      });
      navigate(`/booking/${bookingId}`, { replace: true });
      return;
    }

    if (gateway === 'zalopay' && gatewayReportedSuccess && !isCurrentZalopayPaymentRecorded) {
      message.warning({
        content: 'Giao dịch ZaloPay chưa được hệ thống xác nhận. Số tiền đã thanh toán trước đó vẫn được giữ nguyên.',
        duration: 7,
      });
      navigate(`/booking/${bookingId}`, { replace: true });
      return;
    }

    if (gatewayReportedSuccess && callbackStatus && !callbackMatchesPayment) {
      message.warning({
        content: 'Giao dịch chưa được hệ thống ghi nhận đầy đủ. Vui lòng kiểm tra lại hoặc thử thanh toán lại.',
        duration: 7,
      });
      navigate(`/booking/${bookingId}`, { replace: true });
      return;
    }

    if (paymentResult === 'failed') {
      message.error({
        content: 'Thanh toán chưa thành công hoặc giao dịch đã bị hủy. Vui lòng thử lại.',
        duration: 6,
      });
      navigate(`/booking/${bookingId}`, { replace: true });
    }
  }, [bookingId, navigate, payment?.paymentStatus, searchParams]);

  const startEditReview = () => {
    if (!existingReview) return;
    setReviewRating(existingReview.rating);
    setReviewComment(existingReview.comment || '');
    setReviewImageFileList(imageUrlsToFileList(existingReview.images));
    setIsEditingReview(true);
  };

  const handleSubmitReview = async () => {
    // Còn ảnh đang upload dở dang -> chặn submit để tránh lưu thiếu ảnh
    if (reviewImageFileList.some((file) => file.status === 'uploading')) {
      message.warning('Vui lòng đợi ảnh tải lên xong');
      return;
    }

    const reviewImages = fileListToImageUrls(reviewImageFileList);

    setSubmittingReview(true);
    try {
      if (isEditingReview && existingReview) {
        const wasHidden = existingReview.status === 'hidden';
        await updateReview(existingReview.id, {
          rating: reviewRating,
          comment: reviewComment.trim(),
          images: reviewImages,
        });
        message.success(
          wasHidden ? 'Đã cập nhật đánh giá, đang chờ duyệt lại!' : 'Đã cập nhật đánh giá!',
        );
        setExistingReview({
          ...existingReview,
          rating: reviewRating,
          comment: reviewComment.trim(),
          images: reviewImages,
          // Nếu review trước đó bị ẩn/từ chối và nội dung vừa đổi, backend sẽ
          // đưa về "pending" để duyệt lại; phản ánh ngay trên UI cho khớp.
          status: wasHidden ? 'pending' : existingReview.status,
          hideReason: wasHidden ? null : existingReview.hideReason,
        });
        setIsEditingReview(false);
      } else {
        const res = await createReview({
          bookingId,
          rating: reviewRating,
          comment: reviewComment.trim(),
          images: reviewImages,
        });
        message.success('Cảm ơn bạn đã đánh giá! Đánh giá của bạn đang chờ duyệt.');
        const createBody = (res as unknown as { data?: unknown })?.data ?? res;
        const newId =
          (createBody as { data?: { id?: number } })?.data?.id ??
          (createBody as { id?: number })?.id ??
          0;
        setExistingReview({
          id: newId,
          rating: reviewRating,
          comment: reviewComment.trim(),
          status: 'pending',
          images: reviewImages,
        });
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể lưu đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="booking-detail-page loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!booking) return null;

  const status = String(booking.status);
  const nights = Math.max(
    dayjs(String(booking.check_out)).diff(dayjs(String(booking.check_in)), 'day'),
    0
  );
  const bookingServices = Array.isArray(booking.services)
    ? booking.services as Array<Record<string, unknown>>
    : [];
  const bookingServiceAmount = bookingServices.reduce(
    (sum, service) => sum + Number(service.totalPrice || 0),
    0
  );
  const bookingGuests = Array.isArray(booking.guests)
    ? booking.guests as Array<Record<string, unknown>>
    : [];
  const voucher = booking.voucher as Record<string, unknown> | null;
  const refund = booking.refund as Record<string, unknown> | null;
  const invoiceServiceAmount = invoice
    ? Number(invoice.serviceAmount || payment?.serviceAmount || bookingServiceAmount || 0)
    : 0;
  const invoiceServices = invoice?.services?.length
    ? invoice.services
    : bookingServices.map((service) => ({
        serviceId: Number(service.serviceId || 0),
        serviceName: String(service.serviceName || 'Dịch vụ'),
        quantity: Number(service.quantity || 0),
        unitPrice: Number(service.unitPrice || 0),
        totalPrice: Number(service.totalPrice || 0),
      }));
  const stayRoomAmount = Number(booking.room_price || booking.price_per_night || 0) * nights;
  const invoiceRoomAmount = invoice
    ? Number(invoice.stayRoomAmount || stayRoomAmount || invoice.roomAmount || 0)
    : stayRoomAmount;
  const invoiceSurchargeAmount = invoice
    ? Math.max(Number(invoice.surchargeAmount || 0), Number(invoice.occupancySurcharge || booking.occupancy_surcharge || 0))
    : Number(booking.occupancy_surcharge || 0);
  const invoiceDiscountAmount = invoice
    ? Number(invoice.discountAmount || 0)
    : Number(payment?.discountAmount || 0);
  const invoiceTotalAmount = invoice
    ? Number(invoice.totalAmount || (invoiceRoomAmount + invoiceServiceAmount + invoiceSurchargeAmount - invoiceDiscountAmount))
    : Number(booking.payable_total || booking.total_price || 0);

  const displayTag = getBookingDisplayTag(booking);
  const canShowPhysicalRoom = booking.status === 'checked_in' || booking.status === 'checked_out';

  return (
    <div className="booking-detail-page">
      <div className="detail-hero">
        <h1>Chi tiết đặt phòng #{bookingId}</h1>
        <Tag color={displayTag.color}>
          {displayTag.label}
        </Tag>
      </div>

      <div className="detail-container">
        {booking.status === 'no_show' && (
          <Alert
            type="warning"
            showIcon
            message="Thông báo: Đặt phòng đã chuyển sang trạng thái No-show (Khách không đến)"
            description="Theo quy định của khách sạn, đơn đặt phòng đã quá hạn giữ phòng nên phòng đã được giải phóng. Quý khách đã được tặng mã voucher giảm 10% cho lần đặt tiếp theo. Nếu quý khách có mặt tại khách sạn do sự cố đột xuất, vui lòng liên hệ ngay quầy lễ tân để được hỗ trợ khôi phục nhận phòng."
            style={{ marginBottom: 16 }}
          />
        )}
        <Card title="Thông tin đặt phòng">
          <Descriptions column={{ xs: 1, sm: 2 }} bordered>
            <Descriptions.Item label="Mã đặt phòng">
              {String(booking.booking_code || `#${bookingId}`)}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={displayTag.color}>
                {displayTag.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Khách hàng">{String(booking.customer_name)}</Descriptions.Item>
            <Descriptions.Item label="Email">{String(booking.customer_email)}</Descriptions.Item>
            <Descriptions.Item label="SĐT">{String(booking.customer_phone || '-')}</Descriptions.Item>
            <Descriptions.Item label="Hạng phòng">
              {canShowPhysicalRoom && booking.room_number
                ? `Phòng ${booking.room_number} - ${booking.room_type_name || ''}`
                : `${booking.room_type_name || 'Đặt phòng'} (Số phòng phân bố khi nhận phòng)`}
            </Descriptions.Item>
            {canShowPhysicalRoom && (
              <Descriptions.Item label="Tầng">{String(booking.room_floor ?? '-')}</Descriptions.Item>
            )}
            <Descriptions.Item label="Diện tích">
              {booking.room_area ? `${String(booking.room_area)} m²` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Sức chứa">
              {booking.room_capacity ? `${String(booking.room_capacity)} người` : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày đặt">{formatDate(String(booking.created_at))}</Descriptions.Item>
            <Descriptions.Item label="Nhận phòng">
              <div>{formatDate(String(booking.check_in))}</div>
              {Boolean(booking.actual_check_in_time) ? (
                <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>
                  ✓ Thực tế nhận: <strong>{dayjs(String(booking.actual_check_in_time)).format('HH:mm:ss DD/MM/YYYY')}</strong>
                </div>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label="Giờ check-in dự kiến">
              <Space wrap>
                <span>
                  {booking.requested_check_in_time
                    ? `${String(booking.requested_check_in_time).slice(0, 5)}${Number(booking.requested_check_in_day_offset || 0) === 1 ? ' (ngày hôm sau)' : ''}`
                    : '14:00 (Chuẩn)'}
                </span>
                {!booking.actual_check_in_time &&
                  ['pending', 'confirmed'].includes(status) && (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        const timeStr = booking.requested_check_in_time
                          ? String(booking.requested_check_in_time).slice(0, 5)
                          : '14:00';
                        const offset = Number(booking.requested_check_in_day_offset || 0);
                        setNewArrivalTime(offset === 1 ? `${timeStr}+1` : timeStr);
                        setIsArrivalTimeModalOpen(true);
                      }}
                    >
                      Cập nhật giờ đến
                    </Button>
                  )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Trả phòng">
              <div>{formatDate(String(booking.check_out))} (Trước 12:00)</div>
              {Boolean(booking.actual_check_out_time) ? (
                <div style={{ fontSize: 12, color: '#2563eb', marginTop: 2 }}>
                  ✓ Thực tế trả: <strong>{dayjs(String(booking.actual_check_out_time)).format('HH:mm:ss DD/MM/YYYY')}</strong>
                </div>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label="Số đêm">{nights}</Descriptions.Item>
            <Descriptions.Item label="Giá phòng/đêm">
              {formatPrice(Number(booking.room_price || booking.price_per_night || 0))}
            </Descriptions.Item>
            <Descriptions.Item label="Người lớn">{String(booking.adults || '-')}</Descriptions.Item>
            <Descriptions.Item label="Trẻ em">{String(booking.children || 0)}</Descriptions.Item>
            <Descriptions.Item label="Tổng tiền" span={{ xs: 1, sm: 2 }}>
              <strong>{formatPrice(payment?.totalAmount ?? Number(booking.booking_total_amount || booking.total_price))}</strong>
            </Descriptions.Item>
            {booking.notes ? (
              <Descriptions.Item label="Ghi chú" span={{ xs: 1, sm: 2 }}>
                {String(booking.notes)}
              </Descriptions.Item>
            ) : null}
            {booking.cancellation_reason ? (
              <Descriptions.Item label="Lý do hủy phòng" span={2}>
                <Tag color="red">{String(booking.cancellation_reason)}</Tag>
              </Descriptions.Item>
            ) : null}
            {voucher ? (
              <Descriptions.Item label="Voucher" span={2}>
                <Tag color="purple">{String(voucher.code)}</Tag>{' '}
                {String(voucher.discountType) === 'percentage'
                  ? `Giảm ${Number(voucher.discountValue).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`
                  : `Giảm ${formatPrice(Number(voucher.discountValue || 0))}`}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>

        {(booking as any).transfers && ((booking as any).transfers as any[]).length > 0 && (
          <Card title="Lịch sử chuyển phòng" style={{ borderColor: '#b7eb8f', background: '#f6ffed' }}>
            {((booking as any).transfers as any[]).map((t: any) => (
              <div key={t.id} style={{ marginBottom: 6 }}>
                • Chuyển từ <strong>Phòng {t.fromRoomNumber || t.fromRoomId}</strong> sang <strong>Phòng {t.toRoomNumber || t.toRoomId}</strong> kể từ ngày {formatDate(t.fromDate)}
                {t.reason ? ` (Lý do: ${t.reason})` : ''}
              </div>
            ))}
          </Card>
        )}

        {(booking as any).nightly_prices && ((booking as any).nightly_prices as any[]).length > 0 && (
          <Card title={`Chi tiết giá phòng từng đêm (${((booking as any).nightly_prices as any[]).length} đêm)`}>
            <Table
              rowKey={(r: any) => `${r.stayDate}-${r.roomId || '0'}`}
              size="small"
              pagination={false}
              dataSource={(booking as any).nightly_prices as any[]}
              columns={[
                {
                  title: 'Ngày lưu trú',
                  dataIndex: 'stayDate',
                  render: (val: string, r: any) => (
                    <span>
                      <strong>{dayjs(val).format('DD/MM/YYYY')}</strong> ({r.dayName || ''})
                    </span>
                  ),
                },
                {
                  title: 'Phân loại ngày',
                  dataIndex: 'priceType',
                  render: (type: string, r: any) => {
                    if (r.isHoliday || type === 'holiday') return <Tag color="red">Dịp lễ</Tag>;
                    if (r.isSunday || type === 'sunday') return <Tag color="orange">Chủ nhật</Tag>;
                    if (r.isSaturday || type === 'weekend') return <Tag color="purple">Thứ 7 / Cuối tuần</Tag>;
                    return <Tag color="blue">Ngày thường</Tag>;
                  },
                },
                {
                  title: 'Phòng',
                  dataIndex: 'roomNumber',
                  render: (num?: string, r?: any) => {
                    if (canShowPhysicalRoom) {
                      const roomLabel = num || r?.roomNumber || r?.roomId || booking.room_number;
                      return <Tag color="cyan">P.{roomLabel || '—'}</Tag>;
                    }
                    const typeLabel = r?.typeName || r?.roomTypeName || r?.room_type_name || booking.room_type_name;
                    return (
                      <Tag color="blue">
                        {typeLabel || 'Sắp xếp khi nhận phòng'}
                      </Tag>
                    );
                  },
                },
                {
                  title: 'Đơn giá đêm',
                  dataIndex: 'price',
                  align: 'right' as const,
                  render: (price: number) => <strong style={{ color: '#047857' }}>{formatPrice(price)}</strong>,
                },
                {
                  title: 'Ghi chú / Dịp áp dụng',
                  dataIndex: 'note',
                  render: (note?: string) => note || '—',
                },
              ]}
            />
          </Card>
        )}

        <Card title={`Dịch vụ đã chọn (${bookingServices.length})`}>
          {bookingServices.length > 0 ? (
            <Descriptions column={1} bordered>
              {bookingServices.map((service) => (
                <Descriptions.Item
                  key={String(service.serviceId)}
                  label={String(service.serviceName)}
                >
                  {String(service.quantity)} × {formatPrice(Number(service.unitPrice || 0))}
                  {' = '}
                  <strong>{formatPrice(Number(service.totalPrice || 0))}</strong>
                  {service.description ? <div>{String(service.description)}</div> : null}
                </Descriptions.Item>
              ))}
            </Descriptions>
          ) : (
            <p>Booking này không có dịch vụ bổ sung.</p>
          )}
        </Card>

        <Card
          title={`Danh sách khách lưu trú & CCCD (${bookingGuests.length})`}
          extra={
            ['pending', 'confirmed', 'checked_in'].includes(String(booking.status)) ? (
              <Button
                type="primary"
                ghost
                size="small"
                icon={<UserOutlined />}
                onClick={openGuestModal}
              >
                {bookingGuests.length > 0 ? 'Cập nhật / Bổ sung CCCD' : 'Khai báo thông tin khách & CCCD'}
              </Button>
            ) : null
          }
        >
          {bookingGuests.length > 0 ? (
            <Descriptions column={{ xs: 1, sm: 2 }} bordered>
              {bookingGuests.map((guest, index) => (
                <Descriptions.Item
                  key={String(guest.id || index)}
                  label={`Khách ${index + 1}`}
                >
                  <strong>{String(guest.fullName)}</strong>
                  <div>Giấy tờ / CCCD: {String(guest.identityNumber || 'Chưa bổ sung')}</div>
                  <div>SĐT: {String(guest.phone || '-')}</div>
                </Descriptions.Item>
              ))}
            </Descriptions>
          ) : (
            <div style={{ padding: '8px 0', color: '#64748b' }}>
              Chưa có thông tin CCCD người ở. Quý khách có thể bổ sung sau khi nhận phòng để thuận tiện cho việc lưu trú.
            </div>
          )}
        </Card>

        {payment && (
          <Card
            title="Thanh toán"
            extra={
              ['unpaid', 'deposit_paid'].includes(payment.paymentStatus) ? (
                <Button
                  type="primary"
                  icon={<CreditCardOutlined />}
                  onClick={() => navigate(`/booking/${bookingId}/payment`)}
                >
                  Thanh toán ngay
                </Button>
              ) : null
            }
          >
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Trạng thái">
                <Tag color={paymentStatusMap[payment.paymentStatus]?.color}>
                  {paymentStatusMap[payment.paymentStatus]?.label}
                </Tag>
              </Descriptions.Item>
              {payment.verificationStatus === 'pending' && (
                <Descriptions.Item label="Đối soát chuyển khoản">
                  <Tag color="gold">Chờ khách sạn xác nhận</Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Phương thức">
                {payment.paymentMethod === 'bank_transfer'
                  ? 'Chuyển khoản QR'
                  : payment.paymentMethod === 'cash'
                    ? 'Tiền mặt'
                    : payment.paymentMethod?.toUpperCase() || 'Chưa chọn'}
              </Descriptions.Item>
              <Descriptions.Item label="Tiền phòng tiêu chuẩn">
                {formatPrice((booking as any).price_breakdown?.baseRoomAmount ?? payment.roomAmount)}
              </Descriptions.Item>
              {(booking as any).price_breakdown && ((booking as any).price_breakdown.holidaySurcharge ?? 0) > 0 && (
                <Descriptions.Item label="Phụ thu ngày lễ">
                  <strong style={{ color: '#cf1322' }}>
                    +{formatPrice((booking as any).price_breakdown.holidaySurcharge)}
                  </strong>
                </Descriptions.Item>
              )}
              {(booking as any).price_breakdown &&
                (((booking as any).price_breakdown.sundaySurcharge ?? 0) > 0 || ((booking as any).price_breakdown.weekendSurcharge ?? 0) > 0) && (
                  <Descriptions.Item label="Phụ thu Chủ nhật / Cuối tuần">
                    <strong style={{ color: '#d46b08' }}>
                      +{formatPrice(((booking as any).price_breakdown.sundaySurcharge ?? 0) + ((booking as any).price_breakdown.weekendSurcharge ?? 0))}
                    </strong>
                  </Descriptions.Item>
                )}
              <Descriptions.Item label="Tiền dịch vụ">{formatPrice(payment.serviceAmount)}</Descriptions.Item>
              <Descriptions.Item label="Phụ thu">{formatPrice(payment.surchargeAmount)}</Descriptions.Item>
              <Descriptions.Item label="Tổng cộng">{formatPrice(payment.totalAmount)}</Descriptions.Item>
              <Descriptions.Item label="Đã trả">{formatPrice(payment.paidAmount)}</Descriptions.Item>
              <Descriptions.Item label="Còn lại">{formatPrice(payment.remainingAmount)}</Descriptions.Item>
              {payment.paymentDate && (
                <Descriptions.Item label="Ngày thanh toán">
                  {dayjs(payment.paymentDate).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
              )}
              {payment.transactionCode && (
                <Descriptions.Item label="Mã GD">
                  {payment.transactionCode}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {refund && (
          <Card title="Thông tin hoàn tiền">
            <Descriptions column={{ xs: 1, sm: 2 }} bordered>
              <Descriptions.Item label="Số tiền">
                <strong>{formatPrice(Number(refund.amount || 0))}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Tỷ lệ hoàn">
                {Math.round(Number(refund.refundRate || 0) * 100)}%
              </Descriptions.Item>
              <Descriptions.Item label="Hình thức">
                {refund.refundMethod === 'bank_transfer' ? 'Chuyển khoản ngân hàng' : 'Tiền mặt tại quầy'}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {refund.status === 'approved'
                  ? 'Đã duyệt'
                  : refund.status === 'rejected'
                    ? 'Đã từ chối'
                    : 'Đang chờ duyệt'}
              </Descriptions.Item>
              {refund.note ? (
                <Descriptions.Item label="Ghi chú hoàn tiền" span={2}>
                  {String(refund.note)}
                </Descriptions.Item>
              ) : null}
            </Descriptions>
          </Card>
        )}

        {/* <Card title="Hủy phòng sát giờ nhận phòng" className="cancellation-policy-card">
          <div className="cancellation-policy">
            <div className="policy-row header-row">
              <span>Thời gian hủy</span>
              <span>Hoàn tiền</span>
            </div>
            <div className="policy-row">
              <span>{'< 3 ngày'}</span>
              <span>100%</span>
            </div>
            <div className="policy-row">
              <span>3–7 ngày</span>
              <span>50%</span>
            </div>
            <div className="policy-row">
              <span>{'> 7 ngày'}</span>
              <span>0%</span>
            </div>
          </div>
        </Card> */}

        {invoice && (
          <Card title="Hóa đơn dịch vụ lưu trú" className="invoice-card">
            <div className="invoice-header">
              <FileTextOutlined className="invoice-icon" />
              <div>
                <h3>{invoice.invoiceNumber}</h3>
                <p>Ngày phát hành: {new Date(invoice.issuedAt).toLocaleDateString('vi-VN')}</p>
              </div>
              <Tag color="green">Đã phát hành</Tag>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <div className="invoice-body">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Khoản mục</th>
                    <th style={{ textAlign: 'center' }}>Chi tiết / SL</th>
                    <th style={{ textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>Tiền phòng lưu trú</strong>
                      <small style={{ display: 'block', color: '#888' }}>
                        {canShowPhysicalRoom && booking.room_number
                          ? `Phòng ${String(booking.room_number)} (${booking.room_type_name || ''})`
                          : String(booking.room_type_name || 'Đặt phòng')}
                      </small>
                    </td>
                    <td style={{ textAlign: 'center' }}>{nights} đêm</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(invoiceRoomAmount)}</td>
                  </tr>

                  {invoiceSurchargeAmount > 0 && (
                    <tr>
                      <td>
                        <strong>Phụ thu (trẻ em)</strong>
                        <small style={{ display: 'block', color: '#888' }}>Phụ thu theo chính sách lưu trú trẻ em đi kèm</small>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {Number(booking.children || invoice.childrenCount || 0)} trẻ em
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(invoiceSurchargeAmount)}</td>
                    </tr>
                  )}

                  {invoiceServices.length > 0 && (
                    <>
                      <tr className="invoice-section-header">
                        <td colSpan={2}>
                          <strong>Dịch vụ phát sinh ({invoiceServices.length})</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(invoiceServiceAmount)}</td>
                      </tr>
                      {invoiceServices.map((service, index) => (
                        <tr key={`${service.serviceId}-${index}`} className="invoice-sub-row">
                          <td style={{ paddingLeft: 24 }}>{service.serviceName}</td>
                          <td style={{ textAlign: 'center' }}>
                            {service.quantity} × {formatPrice(service.unitPrice)}
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatPrice(service.totalPrice)}</td>
                        </tr>
                      ))}
                    </>
                  )}

                  {invoiceDiscountAmount > 0 && (
                    <tr className="invoice-discount-row">
                      <td colSpan={2}>
                        <strong style={{ color: '#cf1322' }}>Giảm giá (Voucher)</strong>
                        {Boolean(voucher?.code) && <Tag color="purple" style={{ marginLeft: 8 }}>{String(voucher?.code)}</Tag>}
                      </td>
                      <td style={{ textAlign: 'right', color: '#cf1322', fontWeight: 600 }}>
                        -{formatPrice(invoiceDiscountAmount)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Tiền cọc</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(invoice.depositAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2}>Đã thanh toán</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(invoice.paidAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2}>Còn phải thanh toán</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(invoice.remainingAmount || 0)}</td>
                  </tr>
                  <tr className="invoice-total-row">
                    <td colSpan={2}>
                      <strong style={{ fontSize: 16 }}>Tổng thanh toán</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: 18, color: '#1677ff' }}>{formatPrice(invoiceTotalAmount)}</strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {status === 'checked_out' && (
          <Card
            title={
              <>
                <StarOutlined style={{ color: '#faad14', marginRight: 8 }} />
                Đánh giá phòng {String(booking.room_number)} – {String(booking.room_type_name)}
              </>
            }
          >
            {existingReview && !isEditingReview ? (
              <div>
                <Rate disabled value={existingReview.rating} />
                {existingReview.comment && (
                  <p style={{ marginTop: 10, color: '#4b5563' }}>"{existingReview.comment}"</p>
                )}

                {existingReview.images && existingReview.images.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {existingReview.images.map((src, idx) => (
                      <img
                        key={idx}
                        src={src}
                        alt={`review-${idx}`}
                        width={64}
                        height={64}
                        style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #f0f0f0' }}
                      />
                    ))}
                  </div>
                )}

                {existingReview.status && existingReview.status !== 'approved' ? (
                  <Tag
                    color={reviewStatusMap[existingReview.status]?.color || 'default'}
                    style={{ marginTop: 8 }}
                  >
                    {reviewStatusMap[existingReview.status]?.label || existingReview.status}
                    {existingReview.status === 'hidden' && existingReview.hideReason
                      ? `: ${existingReview.hideReason}`
                      : ''}
                  </Tag>
                ) : (
                  <Tag color="green" style={{ marginTop: 8 }}>
                    Bạn đã đánh giá chuyến đi này
                  </Tag>
                )}

                {existingReview.adminReply && (
                  <div style={{ marginTop: 12, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
                    <strong>Phản hồi của khách sạn:</strong>
                    <p style={{ margin: '4px 0 0' }}>{existingReview.adminReply}</p>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <Button onClick={startEditReview}>Sửa đánh giá</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
                <p style={{ margin: 0, color: '#6b7280' }}>
                  Đánh giá này dành cho phòng {String(booking.room_number)}, hạng{' '}
                  {String(booking.room_type_name)} trong kỳ nghỉ từ {formatDate(String(booking.check_in))} đến{' '}
                  {formatDate(String(booking.check_out))}.
                </p>

                {/* Cảnh báo khi đang sửa 1 review đang chờ duyệt / bị ẩn */}
                {isEditingReview && existingReview?.status === 'pending' && (
                  <Tag color="gold" style={{ width: 'fit-content' }}>
                    Đánh giá đang chờ duyệt.
                  </Tag>
                )}
                {isEditingReview && existingReview?.status === 'hidden' && (
                  <Tag color="red" style={{ width: 'fit-content' }}>
                    Đánh giá đang bị ẩn/từ chối{existingReview.hideReason ? `: ${existingReview.hideReason}` : ''}.
                    Vui lòng chỉnh sửa nội dung trước khi gửi lại.
                  </Tag>
                )}

                <Rate value={reviewRating} onChange={setReviewRating} />
                <Input.TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  placeholder="Cảm nhận về phòng, dịch vụ, nhân viên..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />

                <div>
                  <p style={{ marginBottom: 8 }}>Ảnh thực tế (không bắt buộc, tối đa {MAX_REVIEW_IMAGES} ảnh):</p>
                  <Upload
                    listType="picture-card"
                    fileList={reviewImageFileList}
                    customRequest={uploadReviewImage}
                    beforeUpload={beforeUploadReviewImage}
                    onChange={({ fileList }) => setReviewImageFileList(fileList)}
                    maxCount={MAX_REVIEW_IMAGES}
                    multiple
                    accept="image/*"
                  >
                    {reviewImageFileList.length >= MAX_REVIEW_IMAGES ? null : (
                      <div>
                        <PlusOutlined />
                        <div style={{ marginTop: 8 }}>Thêm ảnh</div>
                      </div>
                    )}
                  </Upload>
                </div>

                <Space>
                  <Button
                    type="primary"
                    loading={submittingReview}
                    disabled={
                      isEditingReview &&
                      existingReview?.status === 'hidden' &&
                      reviewRating === existingReview.rating &&
                      reviewComment.trim().toLowerCase() === (existingReview.comment || '').trim().toLowerCase() &&
                      JSON.stringify([...fileListToImageUrls(reviewImageFileList)].sort()) ===
                        JSON.stringify([...(existingReview.images || [])].sort())
                    }
                    onClick={handleSubmitReview}
                  >
                    {isEditingReview ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
                  </Button>
                  {isEditingReview && (
                    <Button
                      onClick={() => {
                        setIsEditingReview(false);
                        setReviewImageFileList([]);
                      }}
                    >
                      Hủy
                    </Button>
                  )}
                </Space>
              </div>
            )}
          </Card>
        )}

        <div className="detail-actions">
          <Link to="/booking/history">
            <Button size="large">Quay lại lịch sử</Button>
          </Link>
        </div>
      </div>

      <Modal
        title="Cập nhật giờ đến dự kiến"
        open={isArrivalTimeModalOpen}
        onOk={handleUpdateArrivalTime}
        confirmLoading={updatingArrivalTime}
        onCancel={() => setIsArrivalTimeModalOpen(false)}
        okText="Lưu thay đổi"
        cancelText="Hủy"
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            Chọn giờ đến dự kiến mới:
          </label>
          <Select
            style={{ width: '100%' }}
            value={newArrivalTime}
            onChange={(val) => setNewArrivalTime(val)}
            options={[
              { value: '12:00', label: '12:00 (Check-in sớm)' },
              { value: '13:00', label: '13:00' },
              { value: '14:00', label: '14:00 (Giờ chuẩn)' },
              { value: '15:00', label: '15:00' },
              { value: '16:00', label: '16:00' },
              { value: '17:00', label: '17:00' },
              { value: '18:00', label: '18:00' },
              { value: '19:00', label: '19:00' },
              { value: '20:00', label: '20:00' },
              { value: '21:00', label: '21:00' },
              { value: '22:00', label: '22:00' },
              { value: '23:00', label: '23:00' },
              { value: '00:00+1', label: '00:00 (ngày hôm sau)' },
              { value: '01:00+1', label: '01:00 (ngày hôm sau)' },
              { value: '02:00+1', label: '02:00 (ngày hôm sau)' },
              { value: '03:00+1', label: '03:00 (ngày hôm sau)' },
              { value: '04:00+1', label: '04:00 (ngày hôm sau)' },
              { value: '05:00+1', label: '05:00 (ngày hôm sau)' },
              { value: '06:00+1', label: '06:00 (ngày hôm sau)' }
            ]}
          />
          <p style={{ marginTop: 8, color: '#666', fontSize: '13px' }}>
            Hạn check-in của quý khách sẽ tự động được tính lại bằng <strong>Giờ đến + 6 giờ</strong>.
          </p>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            Ghi chú / Lý do (không bắt buộc):
          </label>
          <Input.TextArea
            rows={3}
            placeholder="Ví dụ: Chuyến bay bị hoãn, kẹt xe..."
            value={arrivalNotes}
            onChange={(e) => setArrivalNotes(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        title="Khai báo / Bổ sung thông tin khách lưu trú & CCCD"
        open={isGuestModalOpen}
        onCancel={() => !savingGuests && setIsGuestModalOpen(false)}
        onOk={handleSaveGuests}
        confirmLoading={savingGuests}
        okText="Lưu thông tin"
        cancelText="Đóng"
        width={720}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#334155' }}>
            Đặt phòng: <strong>#{String(booking?.booking_code || booking?.id || '')}</strong> · {String(booking?.room_type_name || '')}
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Quý khách có thể bổ sung họ tên, CCCD/CMND của bản thân và các thành viên cùng phòng bất cứ lúc nào trước hoặc sau khi nhận phòng.
          </div>
          {guestList.map((guest, index) => (
            <Card
              key={index}
              size="small"
              title={<span style={{ fontWeight: 600, fontSize: 13 }}>Khách {index + 1} {index === 0 ? '(Người đại diện đặt)' : ''}</span>}
              extra={
                guestList.length > 1 ? (
                  <Button
                    danger
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setGuestList((prev) => prev.filter((_, i) => i !== index));
                    }}
                  >
                    Xóa
                  </Button>
                ) : null
              }
              style={{ borderRadius: 8 }}
            >
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={8}>
                  <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Họ và tên *</div>
                  <Input
                    placeholder="Họ tên người ở"
                    value={guest.fullName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGuestList((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], fullName: val };
                        return next;
                      });
                    }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Số CCCD / CMND (Tùy chọn)</div>
                  <Input
                    placeholder="CCCD (12 chữ số)"
                    maxLength={12}
                    value={guest.identityNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                      setGuestList((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], identityNumber: val };
                        return next;
                      });
                    }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500 }}>Số điện thoại (Tùy chọn)</div>
                  <Input
                    placeholder="Số điện thoại"
                    value={guest.phone || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGuestList((prev) => {
                        const next = [...prev];
                        next[index] = { ...next[index], phone: val };
                        return next;
                      });
                    }}
                  />
                </Col>
              </Row>
            </Card>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => {
              setGuestList((prev) => [...prev, { fullName: '', identityNumber: '', phone: '', note: '' }]);
            }}
            style={{ borderRadius: 8, height: 40 }}
          >
            Thêm người ở cùng phòng
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default BookingDetail;
