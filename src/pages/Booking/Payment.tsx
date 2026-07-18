import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Button, Spin, message, Tag, Alert, Modal, QRCode, Radio, Tooltip } from 'antd';
import {
  CheckCircleFilled,
  CopyOutlined,
  DollarOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getBookingDetail } from '../../services/bookingService';
import { getPaymentByBookingId, processPayment } from '../../services/paymentService';
import { getPaymentSettings, type PaymentSettings } from '../../services/settingsService';
import { buildVietQrPayload, findBankByBin, toTransferText } from '../../utils/vietqr';
import type { Payment, PaymentMethod } from '../../types/payment';
import momoLogo from '../../assets/payment/momo.png';
import vnpayLogo from '../../assets/payment/vnpay.svg';
import vietqrLogo from '../../assets/payment/vietqr.svg';
import './Payment.css';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + '₫';

const formatDate = (date: string | Date) => {
  return dayjs(date).format('DD/MM/YYYY');
};

const HOLD_MINUTES = 15;
const HOLD_DURATION_MS = HOLD_MINUTES * 60 * 1000;

const getHoldRemainingMs = (createdAt?: unknown) => {
  if (!createdAt) return 0;
  return Math.max(dayjs(String(createdAt)).add(HOLD_MINUTES, 'minute').diff(dayjs()), 0);
};

const formatHoldTime = (milliseconds: number) => {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const statusLabels: Record<string, { label: string; color: string }> = {
  unpaid: { label: 'Chưa thanh toán', color: 'orange' },
  paid: { label: 'Đã thanh toán', color: 'green' },
  refunded: { label: 'Đã hoàn tiền', color: 'red' },
};

interface MethodOption {
  value: PaymentMethod;
  title: string;
  description: string;
  icon: React.ReactNode;
  badgeClass: string;
  badgeText: string;
  recommended?: boolean;
}

const METHOD_OPTIONS: MethodOption[] = [
  {
    value: 'bank_transfer',
    title: 'Chuyển khoản ngân hàng',
    description: 'Quét mã VietQR bằng app ngân hàng bất kỳ',
    icon: <img src={vietqrLogo} alt="VietQR" />,
    badgeClass: 'badge-logo badge-vietqr-logo',
    badgeText: 'VietQR',
    recommended: true,
  },
  {
    value: 'momo',
    title: 'Ví MoMo',
    description: 'Quét mã bằng ứng dụng MoMo',
    icon: <img src={momoLogo} alt="MoMo" />,
    badgeClass: 'badge-logo badge-momo-logo',
    badgeText: 'MoMo',
  },
  {
    value: 'vnpay',
    title: 'VNPay',
    description: 'Quét mã bằng app ngân hàng hỗ trợ VNPay',
    icon: <img src={vnpayLogo} alt="VNPay" />,
    badgeClass: 'badge-logo badge-vnpay-logo',
    badgeText: 'VNPay',
  },
  {
    value: 'cash',
    title: 'Tiền mặt tại quầy',
    description: 'Thanh toán trực tiếp khi đến khách sạn',
    icon: <DollarOutlined />,
    badgeClass: 'badge-cash',
    badgeText: 'Cash',
  },
];

const methodTitle = (method: PaymentMethod) =>
  METHOD_OPTIONS.find((option) => option.value === method)?.title || method;

const PaymentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookingId = Number(id);
  const isValidBookingId = Number.isInteger(bookingId) && bookingId > 0;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [paymentAmountMode, setPaymentAmountMode] = useState<'deposit' | 'full'>('deposit');
  const [holdRemainingMs, setHoldRemainingMs] = useState(0);
  const [roomTakenError, setRoomTakenError] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

  useEffect(() => {
    if (!isValidBookingId) {
      message.error('Mã đặt phòng không hợp lệ');
      navigate('/booking/history');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [bookingRes, paymentRes] = await Promise.all([
          getBookingDetail(bookingId),
          getPaymentByBookingId(bookingId),
        ]);
        setBooking(bookingRes.data as Record<string, unknown>);
        setPayment(paymentRes.data);
      } catch {
        message.error('Không thể tải thông tin thanh toán');
        navigate('/booking/history');
        return;
      } finally {
        setLoading(false);
      }

      try {
        const settingsRes = await getPaymentSettings();
        setPaymentSettings(settingsRes.data);
      } catch {
        // Không chặn thanh toán nếu chưa cấu hình tài khoản nhận tiền
      }
    };

    fetchData();
    window.scrollTo(0, 0);
  }, [bookingId, isValidBookingId, navigate]);

  useEffect(() => {
    if (!booking || payment?.paymentStatus !== 'unpaid') {
      setHoldRemainingMs(0);
      return;
    }

    const updateRemaining = () => {
      setHoldRemainingMs(getHoldRemainingMs(booking.created_at));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(timer);
  }, [booking, payment?.paymentStatus]);

  const isPaid = payment?.paymentStatus === 'paid';
  const hasDeposit = (payment?.paidAmount ?? 0) > 0;
  const requiredDepositAmount = payment
    ? Math.min(Math.ceil(payment.totalAmount * 0.3), payment.remainingAmount)
    : 0;
  const paymentAmount = payment
    ? paymentAmountMode === 'deposit' && !hasDeposit
      ? requiredDepositAmount
      : payment.remainingAmount
    : 0;
  const isHoldExpired = payment?.paymentStatus === 'unpaid' && !hasDeposit && holdRemainingMs <= 0;
  const holdPercent = Math.max(Math.min((holdRemainingMs / HOLD_DURATION_MS) * 100, 100), 0);

  // Đặt cọc là thanh toán từ xa -> không cho chọn tiền mặt tại quầy
  const isDepositMode = paymentAmountMode === 'deposit' && !hasDeposit;
  const visibleMethods = isDepositMode
    ? METHOD_OPTIONS.filter((option) => option.value !== 'cash')
    : METHOD_OPTIONS;

  useEffect(() => {
    if (isDepositMode && paymentMethod === 'cash') {
      setPaymentMethod('bank_transfer');
    }
  }, [isDepositMode, paymentMethod]);

  // Chính sách hoàn tiền (khớp công thức backend: >7 ngày = 100%, 3–7 ngày = 50%, <3 ngày = 0%)
  const refundInfo = useMemo(() => {
    if (!booking?.check_in) return null;

    const checkInDay = dayjs(String(booking.check_in)).startOf('day');
    const today = dayjs().startOf('day');
    const daysBeforeCheckIn = checkInDay.diff(today, 'day');
    const rate = daysBeforeCheckIn > 7 ? 1 : daysBeforeCheckIn >= 3 ? 0.5 : 0;
    const paidAmount = payment?.paidAmount ?? 0;

    return {
      daysBeforeCheckIn,
      rate,
      paidAmount,
      refundableNow: Math.round(paidAmount * rate),
      // Mốc ngày cụ thể cho từng mức hoàn
      fullRefundUntil: checkInDay.subtract(8, 'day'),   // hủy đến hết ngày này: hoàn 100%
      halfRefundFrom: checkInDay.subtract(7, 'day'),    // từ ngày này...
      halfRefundUntil: checkInDay.subtract(3, 'day'),   // ...đến hết ngày này: hoàn 50%
      noRefundFrom: checkInDay.subtract(2, 'day'),      // từ ngày này trở đi: không hoàn
      checkInDay,
    };
  }, [booking?.check_in, payment?.paidAmount]);

  const transferContent = useMemo(() => {
    const prefix = paymentSettings?.transferPrefix || 'HB';
    return toTransferText(`${prefix}${bookingId}`);
  }, [paymentSettings?.transferPrefix, bookingId]);

  const qrValue = useMemo(() => {
    if (paymentMethod === 'bank_transfer') {
      if (!paymentSettings) return '';
      return buildVietQrPayload({
        bankBin: paymentSettings.bankBin,
        accountNumber: paymentSettings.accountNumber,
        amount: paymentAmount,
        addInfo: transferContent,
      });
    }

    const orderInfo = encodeURIComponent(`Thanh toan dat phong ${transferContent}`);
    if (paymentMethod === 'momo') {
      return `https://test-payment.momo.vn/pay?amount=${paymentAmount}&orderId=${transferContent}&orderInfo=${orderInfo}`;
    }
    return `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=${paymentAmount * 100}&vnp_TxnRef=${transferContent}&vnp_OrderInfo=${orderInfo}`;
  }, [paymentMethod, paymentSettings, paymentAmount, transferContent]);

  const bank = paymentSettings ? findBankByBin(paymentSettings.bankBin) : undefined;
  const bankDisplayName = bank?.shortName || paymentSettings?.bankName || paymentSettings?.bankCode || '';

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success(`Đã sao chép ${label}`);
    } catch {
      message.error('Không thể sao chép, vui lòng copy thủ công');
    }
  };

  const submitPayment = async () => {
    if (!payment) return;

    setSubmitting(true);
    setRoomTakenError(false);
    try {
      const result = await processPayment(payment.id, { paymentMethod, amount: paymentAmount });

      if (result.data.redirectUrl && paymentMethod !== 'cash') {
        message.info('Đang chuyển hướng đến cổng thanh toán...');
        if (result.data.redirectUrl.startsWith('/')) {
          navigate(result.data.redirectUrl);
          return;
        }
        window.open(result.data.redirectUrl, '_blank');
        return;
      }

      setQrModalOpen(false);
      message.success('Thanh toán thành công!');
      navigate(`/booking/${bookingId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const errorMessage = err.response?.data?.message || 'Thanh toán thất bại';
      const isRoomTaken = errorMessage.includes('Phòng vừa được đặt bởi khách khác');
      setRoomTakenError(isRoomTaken);
      setQrModalOpen(false);
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = () => {
    if (!payment) return;

    if (paymentMethod === 'cash') {
      submitPayment();
      return;
    }

    if (paymentMethod === 'bank_transfer' && !paymentSettings) {
      message.error('Khách sạn chưa cấu hình tài khoản nhận tiền, vui lòng chọn phương thức khác');
      return;
    }

    // Các phương thức QR: hiện mã để khách quét, xác nhận xong mới ghi nhận thanh toán
    setQrModalOpen(true);
  };

  if (loading) {
    return (
      <div className="payment-page loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!booking || !payment) {
    return null;
  }

  return (
    <div className="payment-page">
      <div className="payment-hero">
        <div className="payment-hero-inner">
          <div className="payment-hero-text">
            <span className="payment-eyebrow">
              <LockOutlined /> Thanh toán an toàn
            </span>
            <h1>Hoàn tất thanh toán</h1>
            <p>
              Đơn đặt phòng <strong>#{bookingId}</strong> · {String(booking.room_number)} ·{' '}
              {String(booking.room_type_name)}
            </p>
          </div>
          <div className="payment-hero-steps">
            <div className="hero-step done">
              <span>1</span> Chọn phòng
            </div>
            <div className="hero-step done">
              <span>2</span> Đặt phòng
            </div>
            <div className="hero-step active">
              <span>3</span> Thanh toán
            </div>
          </div>
        </div>
      </div>

      <div className="payment-container">
        {roomTakenError && (
          <Alert
            className="payment-alert"
            type="error"
            showIcon
            message="Phòng vừa được đặt bởi khách khác"
            description="Khách hàng khác đã thanh toán trước. Vui lòng chọn phòng khác để tiếp tục đặt."
            action={
              <Button size="small" type="primary" onClick={() => navigate('/booking')}>
                Đặt phòng khác
              </Button>
            }
          />
        )}

        <div className="payment-grid">
          {/* Cột trái: thông tin */}
          <div className="payment-main">
            {!isPaid && !hasDeposit && (
              <section className={`pay-card hold-card ${isHoldExpired ? 'expired' : ''}`}>
                <div className="hold-top">
                  <div>
                    <span className="pay-card-label">Thời gian giữ phòng</span>
                    <strong className="hold-time">
                      {isHoldExpired ? 'Đã hết thời gian giữ chỗ' : formatHoldTime(holdRemainingMs)}
                    </strong>
                  </div>
                  <Tag color={isHoldExpired ? 'red' : 'orange'}>
                    {isHoldExpired ? 'Cần đặt lại' : `Giữ tạm ${HOLD_MINUTES} phút`}
                  </Tag>
                </div>
                <div className="hold-progress">
                  <span style={{ width: `${holdPercent}%` }} />
                </div>
                <p>
                  {isHoldExpired
                    ? 'Phiên giữ phòng đã hết hạn. Bạn vui lòng đặt lại để kiểm tra phòng trống mới nhất.'
                    : 'Phòng đang được giữ tạm cho bạn. Hoàn tất thanh toán trước khi hết giờ để xác nhận đặt phòng.'}
                </p>
              </section>
            )}

            {!isPaid && hasDeposit && (
              <section className="pay-card deposit-card">
                <div className="hold-top">
                  <div>
                    <span className="pay-card-label">Đã thanh toán cọc</span>
                    <strong className="hold-time">Phòng đã được giữ</strong>
                  </div>
                  <Tag color="green">Còn lại {formatPrice(payment.remainingAmount)}</Tag>
                </div>
                <p>Bạn đã đặt cọc thành công. Vui lòng thanh toán số tiền còn lại trước khi check-in.</p>
              </section>
            )}

            <section className="pay-card">
              <h3 className="pay-card-title">Thông tin đặt phòng</h3>
              <div className="info-rows">
                <div className="info-row">
                  <span>Phòng</span>
                  <strong>
                    {String(booking.room_number)} · {String(booking.room_type_name)}
                  </strong>
                </div>
                <div className="info-row">
                  <span>Khách hàng</span>
                  <strong>{String(booking.customer_name)}</strong>
                </div>
                <div className="info-row">
                  <span>Nhận phòng</span>
                  <strong>{formatDate(String(booking.check_in))}</strong>
                </div>
                <div className="info-row">
                  <span>Trả phòng</span>
                  <strong>{formatDate(String(booking.check_out))}</strong>
                </div>
                <div className="info-row">
                  <span>Trạng thái</span>
                  <Tag color={statusLabels[payment.paymentStatus]?.color}>
                    {statusLabels[payment.paymentStatus]?.label}
                  </Tag>
                </div>
              </div>
            </section>

            <section className="pay-card">
              <h3 className="pay-card-title">Chính sách hủy phòng & hoàn tiền</h3>

              <div className="policy-grid">
                <div className="policy-item good">
                  <strong>100%</strong>
                  <span>Hủy trước 7 ngày</span>
                  {refundInfo && (
                    <small>Đến hết {refundInfo.fullRefundUntil.format('DD/MM/YYYY')}</small>
                  )}
                </div>
                <div className="policy-item mid">
                  <strong>50%</strong>
                  <span>Hủy trước 3–7 ngày</span>
                  {refundInfo && (
                    <small>
                      {refundInfo.halfRefundFrom.format('DD/MM')} – {refundInfo.halfRefundUntil.format('DD/MM/YYYY')}
                    </small>
                  )}
                </div>
                <div className="policy-item bad">
                  <strong>0%</strong>
                  <span>Hủy dưới 3 ngày</span>
                  {refundInfo && (
                    <small>Từ {refundInfo.noRefundFrom.format('DD/MM/YYYY')}</small>
                  )}
                </div>
              </div>

              {refundInfo && !isPaid && (
                <div
                  className={`refund-now-banner ${
                    refundInfo.rate === 1 ? 'good' : refundInfo.rate === 0.5 ? 'mid' : 'bad'
                  }`}
                >
                  {refundInfo.daysBeforeCheckIn >= 0 ? (
                    <>
                      Hôm nay còn <strong>{refundInfo.daysBeforeCheckIn} ngày</strong> trước ngày nhận phòng (
                      {refundInfo.checkInDay.format('DD/MM/YYYY')}). Nếu hủy ngay bây giờ, bạn được hoàn{' '}
                      <strong>{refundInfo.rate * 100}%</strong> số tiền đã thanh toán
                      {refundInfo.paidAmount > 0 && (
                        <>
                          {' '}= <strong>{formatPrice(refundInfo.refundableNow)}</strong> /{' '}
                          {formatPrice(refundInfo.paidAmount)} đã trả
                        </>
                      )}
                      .
                    </>
                  ) : (
                    <>Đã qua ngày nhận phòng, không thể hủy đặt phòng này.</>
                  )}
                </div>
              )}

              <ul className="policy-notes">
                <li>
                  <strong>Cách tính:</strong> số ngày được tính từ <em>ngày bạn bấm hủy</em> đến{' '}
                  <em>ngày nhận phòng</em>. Tỷ lệ hoàn áp dụng trên <em>tổng số tiền bạn đã thanh toán</em>{' '}
                  (tiền cọc hoặc toàn bộ), không tính trên giá phòng.
                </li>
                <li>
                  <strong>Ví dụ:</strong> đã cọc 300.000₫ — hủy trước 7 ngày nhận lại 300.000₫; hủy trong
                  khoảng 3–7 ngày nhận lại 150.000₫; hủy sát ngày (dưới 3 ngày) không được hoàn.
                </li>
                <li>
                  <strong>Cách hủy:</strong> vào <em>Lịch sử đặt phòng</em> → bấm <em>Hủy</em> ở đơn tương ứng.
                  Chỉ hủy được khi đơn chưa check-in (trạng thái Chờ xác nhận / Đã xác nhận).
                </li>
                <li>
                  <strong>Nhận tiền hoàn:</strong> tiền được hoàn về đúng kênh bạn đã thanh toán (chuyển
                  khoản / ví điện tử) trong vòng <em>5–15 ngày làm việc</em> sau khi lễ tân xác nhận; thanh
                  toán tiền mặt sẽ hoàn trực tiếp tại quầy.
                </li>
                <li>
                  <strong>Không đến nhận phòng (no-show):</strong> nếu quá 6:00 sáng hôm sau ngày nhận phòng
                  mà bạn không check-in, đơn sẽ tự hủy và <em>không được hoàn tiền</em>; hệ thống tặng bạn
                  voucher <em>giảm 10%</em> cho lần đặt kế tiếp.
                </li>
                <li>
                  <strong>Khách sạn hủy:</strong> trường hợp khách sạn không thể phục vụ (sự cố, quá tải),
                  bạn được hoàn <em>100%</em> bất kể thời điểm, kèm ưu đãi đền bù.
                </li>
              </ul>
            </section>
          </div>

          {/* Cột phải: thanh toán */}
          <div className="payment-side">
            <section className="pay-card summary-card">
              <h3 className="pay-card-title">Chi tiết thanh toán</h3>
              <div className="summary-rows">
                <div className="summary-row">
                  <span>Tiền phòng</span>
                  <span>{formatPrice(payment.roomAmount)}</span>
                </div>
                {payment.serviceAmount > 0 && (
                  <div className="summary-row">
                    <span>Dịch vụ</span>
                    <span>{formatPrice(payment.serviceAmount)}</span>
                  </div>
                )}
                {payment.discountAmount > 0 && (
                  <div className="summary-row discount">
                    <span>Giảm giá</span>
                    <span>-{formatPrice(payment.discountAmount)}</span>
                  </div>
                )}
                <div className="summary-row total">
                  <span>Tổng cộng</span>
                  <span>{formatPrice(payment.totalAmount)}</span>
                </div>
                {payment.paidAmount > 0 && (
                  <div className="summary-row">
                    <span>Đã thanh toán</span>
                    <span>{formatPrice(payment.paidAmount)}</span>
                  </div>
                )}
                {!isPaid && (
                  <div className="summary-row remaining">
                    <span>Cần thanh toán</span>
                    <span>{formatPrice(paymentAmount)}</span>
                  </div>
                )}
              </div>

              {!isPaid ? (
                <>
                  {!hasDeposit && (
                    <div className="amount-mode">
                      <Radio.Group
                        value={paymentAmountMode}
                        onChange={(e) => setPaymentAmountMode(e.target.value)}
                        className="amount-mode-group"
                      >
                        <Radio.Button value="deposit">
                          Cọc 30%
                          <small>{formatPrice(requiredDepositAmount)}</small>
                        </Radio.Button>
                        <Radio.Button value="full">
                          Toàn bộ
                          <small>{formatPrice(payment.remainingAmount)}</small>
                        </Radio.Button>
                      </Radio.Group>
                    </div>
                  )}

                  <div className="method-list">
                    {visibleMethods.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`method-item ${paymentMethod === option.value ? 'selected' : ''}`}
                        onClick={() => setPaymentMethod(option.value)}
                      >
                        <span className={`method-badge ${option.badgeClass}`}>{option.icon}</span>
                        <span className="method-text">
                          <span className="method-title">
                            {option.title}
                            {option.recommended && <em>Khuyên dùng</em>}
                          </span>
                          <span className="method-desc">{option.description}</span>
                        </span>
                        <span className="method-check">
                          <CheckCircleFilled />
                        </span>
                      </button>
                    ))}
                  </div>

                  {isDepositMode && (
                    <p className="deposit-online-note">
                      Đặt cọc giữ phòng được thanh toán từ xa qua QR/ví điện tử. Tiền mặt chỉ áp dụng
                      khi thanh toán phần còn lại tại khách sạn.
                    </p>
                  )}

                  <Button
                    className="pay-button"
                    type="primary"
                    size="large"
                    block
                    loading={submitting}
                    disabled={isHoldExpired}
                    onClick={handlePay}
                  >
                    {paymentMethod === 'cash' ? 'Xác nhận thanh toán' : 'Hiện mã QR thanh toán'} ·{' '}
                    {formatPrice(paymentAmount)}
                  </Button>

                  <div className="secure-note">
                    <SafetyCertificateOutlined /> Giao dịch được mã hóa và bảo mật
                  </div>

                  <Link to={`/booking/${bookingId}`} className="back-link">
                    Xem chi tiết đặt phòng
                  </Link>
                </>
              ) : (
                <>
                  <Alert
                    type="success"
                    showIcon
                    message="Đã thanh toán thành công"
                    description={
                      payment.transactionCode ? `Mã giao dịch: ${payment.transactionCode}` : undefined
                    }
                  />
                  <Button
                    className="pay-button"
                    type="primary"
                    size="large"
                    block
                    onClick={() => navigate(`/booking/${bookingId}`)}
                  >
                    Xem hóa đơn & chi tiết
                  </Button>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modal QR chuyên nghiệp */}
      <Modal
        open={qrModalOpen}
        onCancel={() => !submitting && setQrModalOpen(false)}
        footer={null}
        width={840}
        className="qr-pay-modal"
        destroyOnHidden
        centered
      >
        <div className="qr-pay">
          <div className="qr-pay-left">
            <div className="qr-pay-brand">
              {paymentMethod === 'momo' ? (
                <img className="qr-brand-logo" src={momoLogo} alt="MoMo" />
              ) : paymentMethod === 'vnpay' ? (
                <img className="qr-brand-logo" src={vnpayLogo} alt="VNPay" />
              ) : (
                <img className="qr-brand-logo" src={vietqrLogo} alt="VietQR" />
              )}
              <div>
                <strong>{methodTitle(paymentMethod)}</strong>
                <span>
                  {paymentMethod === 'bank_transfer'
                    ? 'Quét bằng app ngân hàng bất kỳ hỗ trợ VietQR / Napas 247'
                    : 'Quét mã bằng ứng dụng tương ứng để thanh toán'}
                </span>
              </div>
            </div>

            <div className="qr-frame">
              <span className="qr-corner tl" />
              <span className="qr-corner tr" />
              <span className="qr-corner bl" />
              <span className="qr-corner br" />
              <QRCode value={qrValue || 'invalid'} size={252} errorLevel="M" bordered={false} />
              <span className="qr-scanline" />
            </div>

            <div className="qr-timer">
              {!hasDeposit && holdRemainingMs > 0 ? (
                <>
                  Mã hết hạn sau <strong>{formatHoldTime(holdRemainingMs)}</strong>
                </>
              ) : (
                <>
                  <SafetyCertificateOutlined /> Giao dịch an toàn qua Napas 247
                </>
              )}
            </div>
          </div>

          <div className="qr-pay-right">
            <h3>Thông tin chuyển khoản</h3>

            <div className="qr-info-list">
              {paymentMethod === 'bank_transfer' && paymentSettings && (
                <>
                  <div className="qr-info-item">
                    <span className="qr-info-label">Ngân hàng</span>
                    <span className="qr-info-value">
                      <strong>{bankDisplayName}</strong>
                    </span>
                  </div>
                  <div className="qr-info-item">
                    <span className="qr-info-label">Chủ tài khoản</span>
                    <span className="qr-info-value">
                      <strong>{paymentSettings.accountName}</strong>
                    </span>
                  </div>
                  <div className="qr-info-item">
                    <span className="qr-info-label">Số tài khoản</span>
                    <span className="qr-info-value">
                      <strong>{paymentSettings.accountNumber}</strong>
                      <Tooltip title="Sao chép">
                        <button
                          type="button"
                          className="copy-btn"
                          onClick={() => copyText(paymentSettings.accountNumber, 'số tài khoản')}
                        >
                          <CopyOutlined />
                        </button>
                      </Tooltip>
                    </span>
                  </div>
                </>
              )}

              <div className="qr-info-item">
                <span className="qr-info-label">Số tiền</span>
                <span className="qr-info-value amount">
                  <strong>{formatPrice(paymentAmount)}</strong>
                  <Tooltip title="Sao chép">
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => copyText(String(paymentAmount), 'số tiền')}
                    >
                      <CopyOutlined />
                    </button>
                  </Tooltip>
                </span>
              </div>

              <div className="qr-info-item">
                <span className="qr-info-label">Nội dung</span>
                <span className="qr-info-value">
                  <strong>{transferContent}</strong>
                  <Tooltip title="Sao chép">
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => copyText(transferContent, 'nội dung chuyển khoản')}
                    >
                      <CopyOutlined />
                    </button>
                  </Tooltip>
                </span>
              </div>
            </div>

            <ol className="qr-steps">
              <li>Mở ứng dụng {paymentMethod === 'bank_transfer' ? 'ngân hàng' : methodTitle(paymentMethod)} trên điện thoại</li>
              <li>Chọn quét mã QR và quét mã bên cạnh</li>
              <li>Kiểm tra đúng số tiền, nội dung rồi xác nhận</li>
              <li>Quay lại đây và bấm “Tôi đã thanh toán”</li>
            </ol>

            <div className="qr-actions">
              <Button size="large" disabled={submitting} onClick={() => setQrModalOpen(false)}>
                Hủy
              </Button>
              <Button size="large" type="primary" loading={submitting} onClick={submitPayment}>
                Tôi đã thanh toán
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PaymentPage;
