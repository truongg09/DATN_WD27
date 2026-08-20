import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Divider,
  Input,
  Modal,
  QRCode,
  Result,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  BellOutlined,
  CopyOutlined,
  DollarOutlined,
  LogoutOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  TagOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../services/api";
import {
  buildVietQrPayload,
  findBankByBin,
  toTransferText,
} from "../../utils/vietqr";

interface ChargeRow {
  id?: number;
  serviceName?: string;
  itemName?: string;
  quantity: number;
  totalPrice: string | number;
  note?: string | null;
  createdAt?: string | null;
  roomId?: number | null;
  roomNumber?: string | null;
  // Tên khách tự đặt cho phòng lúc đặt online ("Phòng bố mẹ"), giúp lễ tân biết
  // dịch vụ này là của phòng nào khi đơn có nhiều phòng cùng hạng.
  roomLabel?: string | null;
  status?: string;
  chargeType?: string;
}

interface PaymentSummary {
  bookingId: number;
  bookingStatus: string;
  customerName: string | null;
  roomNumber: string | null;
  checkOut: string | null;
  standardCheckOutTime: string | null;
  paymentId: number | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  discountAmount?: number;
  voucherCode?: string | null;
  occupancySurcharge?: number;
  surchargeAmount?: number;
  serviceAmount: number;
  damageAmount: number;
  services: ChargeRow[];
  damages: ChargeRow[];
  canCheckOut: boolean;
  transferContent: string;
  bankAccount: {
    bankBin: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
  };
}

interface EarlyCheckoutInfo {
  refundId: number;
  unusedNights: number;
  unusedAmount: number;
  refundRate: number;
  refundAmount: number;
  status: string;
  message: string;
}

const money = (value?: string | number | null) =>
  new Intl.NumberFormat("vi-VN").format(Number(value || 0)) + "₫";

const dateTime = (value?: string | null) =>
  value && dayjs(value).isValid()
    ? dayjs(value).format("HH:mm DD/MM/YYYY")
    : "—";

interface Props {
  bookingId: number | null;
  open: boolean;
  onClose: () => void;
  /** Gọi sau khi trả phòng thành công để danh sách ngoài tự làm mới */
  onCheckedOut: () => void;
}

const CheckoutPaymentModal: React.FC<Props> = ({
  bookingId,
  open,
  onClose,
  onCheckedOut,
}) => {
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voucherInput, setVoucherInput] = useState("");
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [waiveLateFee, setWaiveLateFee] = useState(false);

  const loadSummary = useCallback(
    async (silent = false) => {
      if (!bookingId) return null;
      if (!silent) setLoading(true);
      try {
        const response = await api.get(
          `/bookings/${bookingId}/payment-summary`,
        );
        const data = (response as unknown as { data: PaymentSummary }).data;
        setSummary(data);
        setError(null);
        return data;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })
          .response?.data?.message;
        if (!silent) {
          setError(msg || "Không thể tải thông tin thanh toán");
          setSummary(null);
        }
        return null;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [bookingId],
  );

  useEffect(() => {
    if (!open || !bookingId) {
      setSummary(null);
      setError(null);
      setVoucherInput("");
      return;
    }

    loadSummary();
    setWaiveLateFee(false);
    const timer = window.setInterval(() => loadSummary(true), 8000);
    return () => window.clearInterval(timer);
  }, [open, bookingId, loadSummary]);

  const handleApplyVoucher = async () => {
    if (!summary?.paymentId || !voucherInput.trim()) return;
    setApplyingVoucher(true);
    try {
      await api.post(`/payments/${summary.paymentId}/apply-voucher`, {
        code: voucherInput.trim(),
      });
      message.success("Áp dụng mã giảm giá thành công!");
      setVoucherInput("");
      await loadSummary();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      message.error(msg || "Không thể áp dụng voucher");
    } finally {
      setApplyingVoucher(false);
    }
  };

  const qrValue =
    summary && summary.remainingAmount > 0
      ? buildVietQrPayload({
          bankBin: summary.bankAccount.bankBin,
          accountNumber: summary.bankAccount.accountNumber,
          amount: summary.remainingAmount,
          addInfo: summary.transferContent,
        })
      : "";

  const bank = summary ? findBankByBin(summary.bankAccount.bankBin) : undefined;

  const lateCheckoutWarning = (() => {
    if (!summary?.checkOut || !summary?.standardCheckOutTime) return null;
    const standard = dayjs(
      `${dayjs(summary.checkOut).format("YYYY-MM-DD")}T${summary.standardCheckOutTime}`,
    );
    if (!standard.isValid()) return null;
    const now = dayjs();
    if (now.isBefore(standard)) return null;

    const lateMinutes = now.diff(standard, "minute");
    return {
      lateMinutes,
      standardTimeLabel: summary.standardCheckOutTime.slice(0, 5),
    };
  })();

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success(`Đã sao chép ${label}`);
    } catch {
      message.warning("Trình duyệt không cho phép sao chép tự động");
    }
  };

  // Ghi nhận đã nhận tiền. Chỉ nhân viên gọi được API này — khách không thể tự
  // đánh dấu đã trả tiền.
  const recordPayment = async (paymentMethod: "cash" | "bank_transfer") => {
    if (!summary?.paymentId) return;
    setWorking(true);
    try {
      await api.post(`/payments/${summary.paymentId}/pay`, {
        paymentMethod,
        amount: summary.remainingAmount,
      });
      message.success(
        paymentMethod === "cash"
          ? `Đã thu ${money(summary.remainingAmount)} tiền mặt`
          : `Đã ghi nhận ${money(summary.remainingAmount)} chuyển khoản`,
      );
      await loadSummary();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      message.error(msg || "Không ghi nhận được thanh toán");
    } finally {
      setWorking(false);
    }
  };

  const sendPaymentRequest = async () => {
    if (!bookingId) return;
    setWorking(true);
    try {
      await api.post(`/bookings/${bookingId}/payment-request`);
      message.success("Đã gửi yêu cầu thanh toán vào ứng dụng của khách");
      await loadSummary(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      message.error(msg || "Không gửi được yêu cầu thanh toán");
    } finally {
      setWorking(false);
    }
  };

  const handleCheckOut = async () => {
    if (!bookingId) return;
    setWorking(true);
    try {
      const response = await api.patch(`/bookings/${bookingId}/check-out`, {
        actualCheckOutTime: new Date().toISOString(),
        waiveLateFee,
      });
      const result = (response as any).data?.data;
      const lateFee = result?.lateCheckout?.feeAmount;
      const earlyCheckout: EarlyCheckoutInfo | null =
        result?.earlyCheckout || null;

      if (earlyCheckout) {
        // Trả phòng sớm luôn kèm 1 yêu cầu hoàn tiền tự động chờ duyệt — lễ
        // tân PHẢI biết ngay, không được để phát hiện muộn ở tab Lịch sử.
        Modal.success({
          title: "Đã trả phòng — có yêu cầu hoàn tiền tự động",
          content: (
            <div>
              <p>{earlyCheckout.message}</p>
              <p style={{ color: "#888", fontSize: 13 }}>
                Yêu cầu hoàn tiền đang ở trạng thái chờ duyệt. Vào tab Lịch
                sử/Thanh toán của đặt phòng để theo dõi hoặc xử lý tiếp.
              </p>
            </div>
          ),
          okText: "Đã hiểu",
        });
      } else if (result?.lateCheckoutWarning) {
        // Trả phòng vẫn xong, nhưng phòng đang kẹt lịch với khách kế tiếp —
        // lễ tân phải thấy ngay để dọn gấp hoặc xếp lại phòng.
        Modal.warning({
          title: "Đã trả phòng — cần xử lý phòng ngay",
          content: (
            <div>
              <p>{result.lateCheckoutWarning}</p>
              {lateFee > 0 && (
                <p style={{ color: "#888", fontSize: 13 }}>
                  Đã tính phí trễ giờ {money(lateFee)}.
                </p>
              )}
            </div>
          ),
          okText: "Đã hiểu",
        });
      } else {
        message.success(
          lateFee > 0
            ? `Đã trả phòng. Đã tính phí trễ giờ ${money(lateFee)}.`
            : "Đã trả phòng thành công",
        );
      }

      onCheckedOut();
      onClose();
    } catch (err: unknown) {
      const res = (
        err as {
          response?: {
            data?: {
              message?: string;
              data?: { lateCheckoutWarning?: string | null };
            };
          };
        }
      ).response?.data;
      const msg = res?.message;
      const warning = res?.data?.lateCheckoutWarning;

      // Trường hợp phí trễ giờ vừa được cộng thêm: chưa trả phòng được vì còn
      // nợ tiền, nhưng nếu phòng đang kẹt lịch với khách kế tiếp thì lễ tân
      // phải biết luôn, không để lẫn vào một dòng báo lỗi rồi trôi mất.
      if (warning) {
        Modal.warning({
          title: "Cần xử lý trước khi trả phòng",
          content: (
            <div>
              {msg && <p>{msg}</p>}
              <p>{warning}</p>
            </div>
          ),
          okText: "Đã hiểu",
        });
      } else {
        message.error(msg || "Không thể trả phòng");
      }
      await loadSummary(true);
    } finally {
      setWorking(false);
    }
  };

  const statusLabel: Record<string, string> = {
    used: 'Đã sử dụng',
    unused: 'Chưa sử dụng',
    cancelled: 'Đã hủy',
  };
  const statusColor: Record<string, string> = {
    used: 'green',
    unused: 'orange',
    cancelled: 'default',
  };
  const chargeTypeLabel: Record<string, string> = {
    damage: 'Hư hỏng',
    extra_fee: 'Phí phát sinh',
    other: 'Khoản thu khác',
  };
  const chargeTypeColor: Record<string, string> = {
    damage: 'red',
    extra_fee: 'orange',
    other: 'blue',
  };

  const chargeColumns = [
    {
      title: "Phòng",
      key: "room",
      width: 130,
      render: (_: unknown, row: ChargeRow) => {
        if (!row.roomNumber && !row.roomLabel) {
          return <span style={{ color: '#aaa' }}>—</span>;
        }
        return (
          <div>
            {row.roomNumber ? `P.${row.roomNumber}` : '—'}
            {/* Tên khách tự đặt lúc đặt phòng, để lễ tân mang đồ đúng phòng khi
                đơn có nhiều phòng cùng hạng. */}
            {row.roomLabel && (
              <div style={{ fontSize: 12, color: '#8c8c8c' }}>{row.roomLabel}</div>
            )}
          </div>
        );
      },
    },
    {
      title: "Khoản mục",
      key: "name",
      render: (_: unknown, row: ChargeRow) =>
        row.serviceName || row.itemName || "—",
    },
    { title: "SL", dataIndex: "quantity", align: "center" as const, width: 60 },
    {
      title: "Thành tiền",
      dataIndex: "totalPrice",
      align: "right" as const,
      render: (value: string | number) => <strong>{money(value)}</strong>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 130,
      render: (value?: string) => value ? (
        <Tag color={statusColor[value] || 'default'}>{statusLabel[value] || value}</Tag>
      ) : null,
    },
    { title: "Thời điểm", dataIndex: "createdAt", render: dateTime },
  ];

  return (
    <Modal
      title={
        <span>
          <DollarOutlined style={{ marginRight: 8 }} />
          Thu tiền & trả phòng
          {summary && (
            <Tag style={{ marginLeft: 10 }}>Đơn #{summary.bookingId}</Tag>
          )}
        </span>
      }
      open={open}
      onCancel={onClose}
      width={960}
      style={{ top: 24 }}
      styles={{
        body: {
          maxHeight: "calc(100vh - 170px)",
          overflowY: "auto",
          paddingRight: 8,
        },
      }}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onClose}>Đóng</Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadSummary()}
            loading={loading}
          >
            Kiểm tra lại
          </Button>
          <Tooltip
            title={
              summary?.canCheckOut ? "" : "Phải thu đủ tiền trước khi trả phòng"
            }
          >
            <Button
              type="primary"
              icon={<LogoutOutlined />}
              disabled={!summary?.canCheckOut}
              loading={working}
              onClick={handleCheckOut}
            >
              Trả phòng
            </Button>
          </Tooltip>
        </Space>
      }
    >
      {loading && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin tip="Đang tải công nợ..." />
        </div>
      )}

      {!loading && error && <Alert type="error" message={error} showIcon />}

      {!loading && !error && summary && (
        <>
          <Descriptions
            bordered
            size="small"
            column={3}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Khách hàng">
              {summary.customerName || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Phòng">
              {summary.roomNumber || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Tổng hóa đơn">
              <strong>{money(summary.totalAmount)}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Đã thanh toán">
              <span style={{ color: "#389e0d", fontWeight: 600 }}>
                {money(summary.paidAmount)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Giảm giá (Voucher)">
              <span style={{ color: "#cf1322", fontWeight: 600 }}>
                {summary.discountAmount
                  ? `−${money(summary.discountAmount)}`
                  : "0₫"}
              </span>
              {summary.voucherCode && (
                <Tag color="purple" style={{ marginLeft: 6 }}>
                  {summary.voucherCode}
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Phụ thu trẻ em">
              {money(summary.occupancySurcharge)}
            </Descriptions.Item>
            <Descriptions.Item label="Dịch vụ phát sinh">
              {money(summary.serviceAmount)}
            </Descriptions.Item>
            <Descriptions.Item label="Phí hư hỏng">
              {money(summary.damageAmount)}
            </Descriptions.Item>
          </Descriptions>

          {summary.remainingAmount > 0 && (
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                gap: 10,
                alignItems: "center",
                background: "#fafafa",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #f0f0f0",
              }}
            >
              <TagOutlined style={{ color: "#722ed1" }} />
              <span style={{ fontWeight: 500 }}>Áp dụng mã Voucher:</span>
              <Input
                placeholder="Nhập mã giảm giá"
                value={voucherInput}
                onChange={(e) => setVoucherInput(e.target.value)}
                style={{ width: 220 }}
                disabled={Boolean(summary.voucherCode)}
                onPressEnter={handleApplyVoucher}
              />
              <Button
                type="primary"
                onClick={handleApplyVoucher}
                loading={applyingVoucher}
                disabled={Boolean(summary.voucherCode) || !voucherInput.trim()}
              >
                Áp dụng
              </Button>
              {summary.voucherCode && (
                <Tag
                  color="purple"
                  style={{ fontSize: 13, padding: "4px 8px" }}
                >
                  Đã áp dụng: {summary.voucherCode} (Giảm{" "}
                  {money(summary.discountAmount)})
                </Tag>
              )}
            </div>
          )}

          {lateCheckoutWarning && (
            <div
              style={{
                background: "#fffbe6",
                border: "1px solid #ffe58f",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "#d46b08",
                    fontSize: 13,
                  }}
                >
                  ⏳ Trả phòng muộn (Quá giờ chuẩn{" "}
                  {lateCheckoutWarning.standardTimeLabel} — trễ{" "}
                  {lateCheckoutWarning.lateMinutes} phút)
                </span>
                <Tag color="orange">Trả phòng muộn</Tag>
              </div>
              <div style={{ fontSize: 13, color: "#475569" }}>
                Hệ thống sẽ tự động tính phí phụ thu trễ giờ theo chính sách bậc thang (30%, 50%, 100%) khi trả phòng.
              </div>
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px dashed #ffd591",
                }}
              >
                <Checkbox
                  checked={waiveLateFee}
                  onChange={(e) => setWaiveLateFee(e.target.checked)}
                >
                  <span style={{ fontWeight: 500, color: "#b45309" }}>
                    🎁 Miễn phí phụ thu trả phòng muộn cho khách (Hỗ trợ lễ tân / Khách VIP)
                  </span>
                </Checkbox>
              </div>
            </div>
          )}

          {summary.remainingAmount <= 0 ? (
            <Result
              status="success"
              title="Khách đã thanh toán đủ"
              subTitle="Có thể bấm Trả phòng để hoàn tất thủ tục."
            />
          ) : (
            <>
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`Khách còn phải thanh toán ${money(summary.remainingAmount)}`}
                description="Đưa mã QR bên dưới cho khách quét bằng app ngân hàng, hoặc gửi yêu cầu để khách tự thanh toán trong ứng dụng. Sau khi tiền về, bấm ghi nhận rồi trả phòng."
              />

              <div
                style={{
                  display: "flex",
                  gap: 24,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      padding: 12,
                      background: "#fff",
                      border: "1px solid #eee",
                      borderRadius: 12,
                    }}
                  >
                    <QRCode
                      value={qrValue || "invalid"}
                      size={220}
                      errorLevel="M"
                      bordered={false}
                    />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
                    <QrcodeOutlined /> Quét bằng mọi app ngân hàng (VietQR)
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 300 }}>
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Ngân hàng">
                      {bank?.shortName || summary.bankAccount.bankName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Số tài khoản">
                      {summary.bankAccount.accountNumber}
                      <Button
                        type="link"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() =>
                          copy(
                            summary.bankAccount.accountNumber,
                            "số tài khoản",
                          )
                        }
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label="Chủ tài khoản">
                      {summary.bankAccount.accountName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Số tiền">
                      <strong style={{ color: "#cf1322", fontSize: 16 }}>
                        {money(summary.remainingAmount)}
                      </strong>
                      <Button
                        type="link"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() =>
                          copy(String(summary.remainingAmount), "số tiền")
                        }
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label="Nội dung chuyển khoản">
                      <strong>{toTransferText(summary.transferContent)}</strong>
                      <Button
                        type="link"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() =>
                          copy(
                            toTransferText(summary.transferContent),
                            "nội dung chuyển khoản",
                          )
                        }
                      />
                      <div style={{ fontSize: 12, color: "#888" }}>
                        Giữ đúng nội dung này để đối soát sao kê theo mã đặt
                        phòng.
                      </div>
                    </Descriptions.Item>
                  </Descriptions>

                  <Space wrap style={{ marginTop: 12 }}>
                    <Button
                      icon={<BellOutlined />}
                      onClick={sendPaymentRequest}
                      loading={working}
                    >
                      Gửi yêu cầu vào app của khách
                    </Button>
                    <Button
                      type="primary"
                      loading={working}
                      onClick={() => recordPayment("bank_transfer")}
                    >
                      Đã nhận chuyển khoản
                    </Button>
                    <Button
                      loading={working}
                      onClick={() => recordPayment("cash")}
                    >
                      Thu tiền mặt
                    </Button>
                  </Space>
                </div>
              </div>
            </>
          )}

          {summary.services.some((service) => service.status === 'used') && (
            <>
              <Divider style={{ margin: "12px 0" }}>
                Dịch vụ đã sử dụng ({summary.services.filter(s => s.status === 'used').length})
              </Divider>
              <Table
                rowKey={(row, index) => `svc-${row.id || index}`}
                size="small"
                pagination={false}
                dataSource={summary.services.filter((service) => service.status === 'used')}
                columns={chargeColumns}
              />
            </>
          )}

          {summary.damages.length > 0 && (
            <>
              <Divider style={{ margin: "12px 0" }}>
                Phí hư hỏng / Phát sinh ({summary.damages.filter(d => d.status !== 'cancelled').length})
              </Divider>
              <Table
                rowKey={(row, index) => `dmg-${row.id || index}`}
                size="small"
                pagination={false}
                dataSource={summary.damages}
                columns={[
                  chargeColumns[0],
                  {
                    title: "Loại",
                    dataIndex: "chargeType",
                    width: 120,
                    render: (v?: string) => v ? (
                      <Tag color={chargeTypeColor[v] || 'default'}>{chargeTypeLabel[v] || v}</Tag>
                    ) : null,
                  },
                  ...chargeColumns.slice(1, 3),
                  chargeColumns[3],
                  {
                    title: "Ghi chú",
                    dataIndex: "note",
                    render: (v?: string | null) => v || "—",
                  },
                  chargeColumns[4],
                  chargeColumns[5],
                ]}
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
};

export default CheckoutPaymentModal;
