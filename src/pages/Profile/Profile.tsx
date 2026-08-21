import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Avatar,
  Typography,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Table,
  Tag,
  message,
  Space,
  Badge,
  Modal,
  InputNumber,
  Radio,
  List,
  Empty
} from "antd";
import {
  UserOutlined,
  CreditCardOutlined,
  CalendarOutlined,
  GiftOutlined,
  LogoutOutlined,
  LockOutlined,
  TrophyOutlined,
  AuditOutlined,
  BellOutlined,
  SolutionOutlined,
  DollarCircleOutlined,
  CopyOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { getMyRefunds, type RefundRow } from "../../services/refundService";
import {
  getMyWallet,
  requestWithdraw,
  type WalletBalance,
  type WalletTransaction
} from "../../services/walletService";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead
} from "../../services/notificationService";
import type { NotificationItem } from "../../types/notification";
import { VIETQR_BANKS } from "../../utils/vietqr";
import { getBookingStatusMeta } from "../../constants/bookingStatus";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;

interface CustomerProfile {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  gender?: string;
  dateOfBirth?: string;
  citizenId?: string;
  nationality?: string;
  address?: string;
}

interface BookingHistoryItem {
  id: number;
  bookingCode: string;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  bookingStatus: string;
}

interface VoucherItem {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number;
  endDate: string;
  status: string;
}

function Profile() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form] = Form.useForm();
  // Form đổi mật khẩu là một Form riêng. Trước đây nó gọi form.resetFields() của
  // form hồ sơ (đã bị gỡ khỏi cây khi chuyển tab) nên các ô mật khẩu vẫn còn
  // nguyên nội dung sau khi đổi thành công.
  const [passwordForm] = Form.useForm();

  // State quản lý tab đang chọn trong sidebar
  const getInitialTab = () => {
    const tabParam = searchParams.get("tab") || (location.state as { tab?: string } | null)?.tab;
    const validTabs = ["profile-edit", "bookings", "refunds", "notifications", "vouchers", "change-password"];
    if (tabParam && validTabs.includes(tabParam)) {
      return tabParam;
    }
    return "profile-edit";
  };

  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [bookings, setBookings] = useState<BookingHistoryItem[]>([]);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [walletBalance, setWalletBalance] = useState<WalletBalance>({ credited: 0, pendingWithdraw: 0, available: 0 });
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [withdrawMethod, setWithdrawMethod] = useState<"cash" | "bank_transfer">("bank_transfer");
  const [withdrawBankBin, setWithdrawBankBin] = useState<string | undefined>(undefined);
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [withdrawAccountName, setWithdrawAccountName] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);

  // Fetch dữ liệu thông tin cá nhân
  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const response = await api.get(`/customers/by-account/${user.id}`);
      const data = response.data?.data || response.data || response;
      if (data) {
        setProfile(data);
        form.setFieldsValue({
          fullName: data.fullName,
          phone: data.phone,
          email: data.email,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth ? dayjs(data.dateOfBirth) : null,
          citizenId: data.citizenId,
          nationality: data.nationality,
          address: data.address
        });

        // Tiện tay fetch list bookings của customer này
        fetchBookings(data.id);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      message.error("Lỗi khi tải thông tin tài khoản");
    } finally {
      setLoading(false);
    }
  };

  // Fetch lịch sử đặt phòng của khách hàng
  const fetchBookings = async (customerId: number) => {
    try {
      const response = await api.get(`/customers/bookings?id=${customerId}`);
      const data = response.data?.data || response.data || [];
      if (Array.isArray(data)) {
        setBookings(data);
      }
    } catch (error) {
      console.error("Error fetching customer bookings:", error);
    }
  };

  // Fetch danh sách vouchers khuyến mãi.
  // Gọi /vouchers/me chứ không phải /vouchers: endpoint kia là danh sách quản
  // trị và trả về cả voucher đền bù tặng riêng cho khách khác.
  const fetchVouchers = async () => {
    try {
      const response = await api.get("/vouchers/me");
      const data = response.data?.data || response.data || [];
      if (Array.isArray(data)) {
        setVouchers(data);
      }
    } catch (error) {
      console.error("Error fetching vouchers:", error);
    }
  };

  // Fetch danh sách hoàn tiền của khách
  const fetchRefunds = async () => {
    try {
      const response = await getMyRefunds();
      const data = (response as { data?: RefundRow[] }).data || [];
      if (Array.isArray(data)) {
        setRefunds(data);
      }
    } catch (error) {
      console.error("Error fetching refunds:", error);
    }
  };

  // Fetch ví (số dư + lịch sử giao dịch)
  const fetchWallet = async () => {
    try {
      const response = await getMyWallet();
      const data = (response as { data?: { balance: WalletBalance; transactions: WalletTransaction[] } }).data;
      if (data) {
        setWalletBalance(data.balance);
        setWalletTransactions(data.transactions);
      }
    } catch (error) {
      console.error("Error fetching wallet:", error);
    }
  };

  // Gửi lệnh rút tiền
  const handleWithdraw = async () => {
    if (withdrawAmount <= 0) {
      message.error("Số tiền rút phải lớn hơn 0");
      return;
    }
    if (withdrawAmount > walletBalance.available) {
      message.error("Số tiền rút vượt quá số dư khả dụng");
      return;
    }
    if (withdrawMethod === "bank_transfer") {
      if (!withdrawBankBin) {
        message.error("Vui lòng chọn ngân hàng nhận tiền");
        return;
      }
      if (!/^\d{4,30}$/.test(withdrawAccountNumber.replace(/\s+/g, ""))) {
        message.error("Số tài khoản ngân hàng chỉ được bao gồm các chữ số (0-9)");
        return;
      }
      if (withdrawAccountName.trim().length < 3) {
        message.error("Vui lòng nhập tên chủ tài khoản");
        return;
      }
    }

    const bank = VIETQR_BANKS.find((b) => b.bin === withdrawBankBin);
    setWithdrawSubmitting(true);
    try {
      await requestWithdraw({
        amount: withdrawAmount,
        refundMethod: withdrawMethod,
        bankBin: withdrawBankBin,
        bankName: bank?.shortName,
        accountNumber: withdrawAccountNumber.replace(/\s+/g, ""),
        accountName: withdrawAccountName.trim().toUpperCase()
      });
      message.success("Đã gửi yêu cầu rút tiền, chờ khách sạn duyệt");
      setWithdrawOpen(false);
      fetchWallet();
    } catch (error: any) {
      message.error(error.response?.data?.message || "Không thể gửi yêu cầu rút tiền");
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const [profileNotifications, setProfileNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const fetchProfileNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const res = await getMyNotifications({ limit: 50 });
      setProfileNotifications(res.data || []);
      setUnreadNotifCount(res.unreadCount || 0);
    } catch {
      // Ignored
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchProfile();
    fetchVouchers();
    fetchRefunds();
    fetchWallet();
    fetchProfileNotifications();
  }, [user]);

  useEffect(() => {
    const tabParam = searchParams.get("tab") || (location.state as { tab?: string } | null)?.tab;
    const validTabs = ["profile-edit", "bookings", "refunds", "notifications", "vouchers", "change-password"];
    if (tabParam && validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
      if (tabParam === "vouchers") {
        fetchVouchers();
      } else if (tabParam === "notifications") {
        fetchProfileNotifications();
      } else if (tabParam === "refunds") {
        fetchRefunds();
        fetchWallet();
      }
    }
  }, [searchParams, location.state]);

  // Cập nhật thông tin hồ sơ
  const handleUpdateProfile = async (values: any) => {
    if (!profile) return;
    try {
      setSaveLoading(true);
      const payload = {
        id: profile.id,
        fullName: values.fullName,
        phone: values.phone,
        email: values.email,
        gender: values.gender,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format("YYYY-MM-DD") : null,
        citizenId: values.citizenId,
        nationality: values.nationality,
        address: values.address
      };

      await api.post("/customers/update", payload);
      message.success("Cập nhật hồ sơ thành công!");
      // Đồng bộ luôn vào phiên đăng nhập để tên trên đầu trang và phần điền sẵn
      // ở form đặt phòng đổi theo ngay, không phải đăng nhập lại.
      updateUser({
        fullName: values.fullName,
        phone: values.phone,
        email: values.email,
      });
      fetchProfile();
    } catch (error: any) {
      console.error("Update profile error:", error);
      message.error(error.response?.data?.error || "Cập nhật hồ sơ thất bại");
    } finally {
      setSaveLoading(false);
    }
  };

  // Sao chép mã khuyến mãi
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    message.success(`Đã sao chép mã khuyến mãi: ${code}`);
  };

  // Thực hiện đăng xuất
  const handleLogout = () => {
    logout();
    message.success("Đăng xuất thành công!");
    navigate("/");
  };

  // Style phụ trợ
  const sidebarHeaderStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #ab8965 0%, #d4b285 100%)",
    padding: "24px",
    borderRadius: "16px 16px 0 0",
    color: "#fff",
    textAlign: "center"
  };

  const menuItemStyle = (tabKey: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    padding: "14px 20px",
    fontSize: "15px",
    fontWeight: activeTab === tabKey ? "600" : "400",
    color: activeTab === tabKey ? "#ab8965" : "#333",
    backgroundColor: activeTab === tabKey ? "#fbf8f3" : "transparent",
    borderLeft: activeTab === tabKey ? "4px solid #ab8965" : "4px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s"
  });

  return (
    <div style={{ padding: "120px 20px 40px", maxWidth: "1200px", margin: "0 auto", minHeight: "80vh" }}>
      <Row gutter={[24, 24]}>
        
        {/* SIDEBAR MENU */}
        <Col xs={24} md={8} lg={7}>
          <div style={{ backgroundColor: "#fff", borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={sidebarHeaderStyle}>
              <Avatar size={70} icon={<UserOutlined />} style={{ border: "3px solid rgba(255,255,255,0.6)", backgroundColor: "#fff", color: "#ab8965" }} />
              <Title level={4} style={{ color: "#fff", margin: "12px 0 4px", fontSize: "18px" }}>
                {profile?.fullName || user?.email?.split("@")[0] || "Khách hàng"}
              </Title>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "13px" }}>
                <TrophyOutlined style={{ color: "#ffd700" }} />
                <Text style={{ color: "#fefefe", fontWeight: 500 }}>Thành viên Bronze Priority</Text>
              </div>
            </div>

            {/* Menu options giống ảnh mockup */}
            <div style={{ padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: "1px solid #f0f0f0" }}>
                <TrophyOutlined style={{ fontSize: "18px", color: "#ab8965", marginRight: "12px" }} />
                <div>
                  <div style={{ fontSize: "12px", color: "#888" }}>Điểm tích lũy</div>
                  <strong style={{ fontSize: "15px" }}>0 Điểm</strong>
                </div>
              </div>

              <div style={menuItemStyle("profile-edit")} onClick={() => setActiveTab("profile-edit")}>
                <UserOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <span>Chỉnh sửa hồ sơ</span>
              </div>

              <div style={menuItemStyle("my-cards")} onClick={() => {
                setActiveTab("my-cards");
                message.info("Tính năng thẻ thành viên đang được xây dựng!");
              }}>
                <CreditCardOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <span>Thẻ của tôi</span>
              </div>

              <div style={menuItemStyle("transactions")} onClick={() => {
                setActiveTab("transactions");
                message.info("Tính năng giao dịch đang được nâng cấp!");
              }}>
                <AuditOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <span>Danh sách giao dịch</span>
              </div>

              <div style={menuItemStyle("bookings")} onClick={() => setActiveTab("bookings")}>
                <CalendarOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <span>Lịch sử đặt phòng</span>
              </div>

              <div style={menuItemStyle("refunds")} onClick={() => {
                setActiveTab("refunds");
                fetchRefunds();
                fetchWallet();
              }}>
                <DollarCircleOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <Space>
                  <span>Hoàn tiền</span>
                  <Badge
                    count={refunds.filter((r) => r.status === "pending").length}
                    style={{ backgroundColor: "#faad14", color: "#fff", fontSize: "10px" }}
                  />
                </Space>
              </div>

              <div style={menuItemStyle("notifications")} onClick={() => {
                setActiveTab("notifications");
                fetchProfileNotifications();
              }}>
                <BellOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <Space>
                  <span>Thông báo của tôi</span>
                  <Badge
                    count={unreadNotifCount}
                    style={{ backgroundColor: "#1677ff", color: "#fff", fontSize: "10px" }}
                  />
                </Space>
              </div>

              <div style={menuItemStyle("saved-passengers")} onClick={() => {
                setActiveTab("saved-passengers");
                message.info("Thông tin hành khách sẽ tự động lưu khi đặt chỗ.");
              }}>
                <SolutionOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <span>Thông tin hành khách đã lưu</span>
              </div>

              <div style={menuItemStyle("vouchers")} onClick={() => setActiveTab("vouchers")}>
                <GiftOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <span>Khuyến mãi</span>
              </div>

              <div style={menuItemStyle("change-password")} onClick={() => setActiveTab("change-password")}>
                <LockOutlined style={{ marginRight: "12px", fontSize: "17px" }} />
                <span>Đổi mật khẩu</span>
              </div>

              <div style={menuItemStyle("logout")} onClick={handleLogout}>
                <LogoutOutlined style={{ marginRight: "12px", fontSize: "17px", color: "#ff4d4f" }} />
                <span style={{ color: "#ff4d4f" }}>Đăng xuất</span>
              </div>
            </div>
          </div>
        </Col>

        {/* TAB DETAIL CONTENTS */}
        <Col xs={24} md={16} lg={17}>
          <Card style={{ borderRadius: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", minHeight: "600px" }} loading={loading}>
            
            {/* TAB: CHỈNH SỬA HỒ SƠ */}
            {activeTab === "profile-edit" && (
              <div>
                <Title level={3} style={{ marginBottom: "24px", color: "#2b2420" }}>Thông tin cá nhân</Title>
                <Form form={form} layout="vertical" onFinish={handleUpdateProfile}>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="fullName"
                        label="Họ và tên"
                        rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
                      >
                        <Input size="large" placeholder="Nhập họ và tên" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="phone"
                        label="Số điện thoại"
                        rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}
                      >
                        <Input size="large" placeholder="Nhập số điện thoại" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="email" label="Địa chỉ Email">
                        <Input size="large" disabled style={{ backgroundColor: "#f5f5f5" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="gender" label="Giới tính">
                        <Select size="large" placeholder="Chọn giới tính">
                          <Option value="male">Nam</Option>
                          <Option value="female">Nữ</Option>
                          <Option value="other">Khác</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="dateOfBirth" label="Ngày sinh">
                        <DatePicker size="large" format="DD/MM/YYYY" style={{ width: "100%" }} placeholder="Chọn ngày sinh" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="citizenId"
                        label="Số CCCD (12 chữ số)"
                        rules={[
                          { pattern: /^\d{12}$/, message: "Số CCCD phải bao gồm đúng 12 chữ số (không chứa chữ cái hoặc ký hiệu)" }
                        ]}
                      >
                        <Input
                          size="large"
                          placeholder="Nhập đúng 12 số CCCD"
                          maxLength={12}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 12);
                            form.setFieldsValue({ citizenId: val });
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item name="nationality" label="Quốc tịch">
                        <Input size="large" placeholder="Ví dụ: Việt Nam, Hàn Quốc..." />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="address" label="Địa chỉ thường trú">
                        <Input size="large" placeholder="Nhập địa chỉ của bạn" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item style={{ marginTop: "24px" }}>
                    <Button type="primary" htmlType="submit" size="large" loading={saveLoading} style={{ backgroundColor: "#ab8965", borderColor: "#ab8965", minWidth: "150px" }}>
                      Lưu thông tin
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            )}

            {/* TAB: Lịch sử đặt phòng */}
            {activeTab === "bookings" && (
              <div>
                <Title level={3} style={{ marginBottom: "24px", color: "#2b2420" }}>Lịch sử đặt phòng</Title>
                <Table
                  dataSource={bookings}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  columns={[
                    {
                      title: "Mã đơn đặt",
                      dataIndex: "bookingCode",
                      key: "bookingCode",
                      render: (text) => <strong>{text}</strong>
                    },
                    {
                      title: "Loại phòng",
                      dataIndex: "roomType",
                      key: "roomType",
                      render: (text) => text || "Đang xếp phòng"
                    },
                    {
                      title: "Ngày nhận",
                      dataIndex: "checkInDate",
                      key: "checkInDate",
                      render: (date) => dayjs(date).format("DD/MM/YYYY")
                    },
                    {
                      title: "Ngày trả",
                      dataIndex: "checkOutDate",
                      key: "checkOutDate",
                      render: (date) => dayjs(date).format("DD/MM/YYYY")
                    },
                    {
                      title: "Tổng tiền",
                      dataIndex: "totalAmount",
                      key: "totalAmount",
                      render: (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount)
                    },
                    {
                      title: "Trạng thái",
                      dataIndex: "bookingStatus",
                      key: "bookingStatus",
                      render: (status) => {
                        const meta = getBookingStatusMeta(status);
                        return <Tag color={meta.color}>{meta.label}</Tag>;
                      }
                    }
                  ]}
                />
              </div>
            )}

            {/* TAB: KHUYẾN MÃI */}
            {activeTab === "vouchers" && (
              <div>
                <Title level={3} style={{ marginBottom: "24px", color: "#2b2420" }}>Voucher Khuyến mãi khả dụng</Title>
                <Row gutter={[16, 16]}>
                  {vouchers.length === 0 ? (
                    <Col span={24}>
                      <Card style={{ textAlign: "center", padding: "40px" }}>
                        <Text type="secondary">Hiện tại chưa có mã khuyến mãi nào khả dụng.</Text>
                      </Card>
                    </Col>
                  ) : (
                    vouchers.map((voucher) => (
                      <Col xs={24} sm={12} key={voucher.id}>
                        <Card style={{ borderLeft: "5px solid #ab8965", borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
                          <Row justify="space-between" align="middle">
                            <Col>
                              <Tag color="gold" style={{ fontSize: "14px", padding: "4px 8px", fontWeight: "bold" }}>{voucher.code}</Tag>
                              <div style={{ marginTop: "12px", fontWeight: 600, fontSize: "16px" }}>
                                {voucher.discountType === "percentage" 
                                  ? `Giảm ${Number(voucher.discountValue).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}% giá phòng` 
                                  : `Giảm trực tiếp ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(voucher.discountValue)}`
                                }
                              </div>
                              {voucher.maxDiscount > 0 && (
                                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                                  Giảm tối đa: {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(voucher.maxDiscount)}
                                </div>
                              )}
                              <div style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
                                Hạn sử dụng: {dayjs(voucher.endDate).format("DD/MM/YYYY")}
                              </div>
                            </Col>
                            <Col>
                              <Button type="dashed" shape="circle" icon={<CopyOutlined />} onClick={() => copyToClipboard(voucher.code)} />
                            </Col>
                          </Row>
                        </Card>
                      </Col>
                    ))
                  )}
                </Row>
              </div>
            )}

            {/* TAB: VÍ & HOÀN TIỀN */}
            {activeTab === "refunds" && (
              <div>
                <Title level={3} style={{ marginBottom: "24px", color: "#2b2420" }}>Ví & Hoàn tiền</Title>

                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={10}>
                    <Card
                      style={{
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, #1f6e43 0%, #2e9e63 100%)",
                        color: "#fff"
                      }}
                    >
                      <div style={{ opacity: 0.85, fontSize: 13 }}>Số dư khả dụng</div>
                      <div style={{ fontSize: 28, fontWeight: 700, margin: "6px 0 14px" }}>
                        {new Intl.NumberFormat("vi-VN").format(walletBalance.available)}₫
                      </div>
                      <Button
                        type="primary"
                        disabled={walletBalance.available <= 0}
                        style={{ background: "#fff", color: "#1f6e43", fontWeight: 600, border: "none" }}
                        onClick={() => {
                          setWithdrawAmount(walletBalance.available);
                          setWithdrawMethod("bank_transfer");
                          setWithdrawBankBin(undefined);
                          setWithdrawAccountNumber("");
                          setWithdrawAccountName("");
                          setWithdrawOpen(true);
                        }}
                      >
                        Rút tiền
                      </Button>
                    </Card>
                  </Col>
                  <Col xs={24} sm={7}>
                    <Card style={{ borderLeft: "5px solid #faad14", borderRadius: "8px" }}>
                      <Text type="secondary">Đang chờ rút</Text>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#b45309" }}>
                        {new Intl.NumberFormat("vi-VN").format(walletBalance.pendingWithdraw)}₫
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={7}>
                    <Card style={{ borderLeft: "5px solid #1677ff", borderRadius: "8px" }}>
                      <Text type="secondary">Chờ duyệt hoàn tiền</Text>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#1677ff" }}>
                        {new Intl.NumberFormat("vi-VN").format(
                          refunds
                            .filter((r) => r.status === "pending")
                            .reduce((sum, r) => sum + Number(r.amount || 0), 0)
                        )}₫
                      </div>
                    </Card>
                  </Col>
                </Row>

                <Title level={5} style={{ margin: "8px 0 12px" }}>Lịch sử ví</Title>
                <Table
                  dataSource={walletTransactions}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  style={{ marginBottom: 28 }}
                  locale={{ emptyText: "Chưa có giao dịch ví. Tiền hoàn sẽ vào ví khi khách sạn duyệt yêu cầu hoàn." }}
                  columns={[
                    {
                      title: "Giao dịch",
                      key: "type",
                      render: (_: unknown, record: WalletTransaction) =>
                        record.type === "refund_credit" ? (
                          <div>
                            <Tag color="green">+ Hoàn tiền vào ví</Tag>
                            {record.bookingId && (
                              <div style={{ fontSize: 12, color: "#999" }}>Đặt phòng #{record.bookingId}</div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <Tag color="orange">- Rút tiền</Tag>
                            <div style={{ fontSize: 12, color: "#999" }}>
                              {record.refundMethod === "cash"
                                ? "Tiền mặt tại quầy"
                                : `${record.bankName || ""} ${record.accountNumber || ""}`}
                            </div>
                          </div>
                        )
                    },
                    {
                      title: "Số tiền",
                      key: "amount",
                      render: (_: unknown, record: WalletTransaction) => (
                        <strong style={{ color: record.type === "refund_credit" ? "#15803d" : "#b45309" }}>
                          {record.type === "refund_credit" ? "+" : "-"}
                          {new Intl.NumberFormat("vi-VN").format(Number(record.amount))}₫
                        </strong>
                      )
                    },
                    {
                      title: "Số dư trước",
                      key: "balanceBefore",
                      align: "right" as const,
                      render: (_: unknown, record: WalletTransaction) => (
                        <span style={{ color: "#666" }}>
                          {new Intl.NumberFormat("vi-VN").format(Number(record.balanceBefore ?? 0))}₫
                        </span>
                      )
                    },
                    {
                      title: "Số dư sau",
                      key: "balanceAfter",
                      align: "right" as const,
                      render: (_: unknown, record: WalletTransaction) => {
                        // Lệnh rút bị từ chối không làm đổi số dư, ghi rõ để khách
                        // không tưởng tiền đã bị trừ.
                        const unchanged = Number(record.balanceDelta ?? 0) === 0;
                        return (
                          <div>
                            <strong>
                              {new Intl.NumberFormat("vi-VN").format(Number(record.balanceAfter ?? 0))}₫
                            </strong>
                            {unchanged && (
                              <div style={{ fontSize: 11, color: "#999" }}>không đổi</div>
                            )}
                          </div>
                        );
                      }
                    },
                    {
                      title: "Ngày",
                      dataIndex: "createdAt",
                      key: "createdAt",
                      render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm")
                    },
                    {
                      title: "Trạng thái",
                      key: "status",
                      render: (_: unknown, record: WalletTransaction) => (
                        <div>
                          <Tag
                            color={
                              record.status === "pending"
                                ? "gold"
                                : record.status === "approved"
                                  ? "green"
                                  : "red"
                            }
                          >
                            {record.status === "pending"
                              ? "Chờ duyệt"
                              : record.status === "approved"
                                ? "Hoàn tất"
                                : "Từ chối"}
                          </Tag>
                          {record.note && (
                            <div style={{ fontSize: 12, color: "#999", maxWidth: 220 }}>{record.note}</div>
                          )}
                        </div>
                      )
                    }
                  ]}
                />

                <Title level={5} style={{ margin: "8px 0 12px" }}>Yêu cầu hoàn tiền khi hủy phòng</Title>
                <Table
                  dataSource={refunds}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 5 }}
                  locale={{ emptyText: "Bạn chưa có yêu cầu hoàn tiền nào. Yêu cầu sẽ tự tạo khi bạn hủy đặt phòng đã thanh toán." }}
                  columns={[
                    {
                      title: "Đặt phòng",
                      dataIndex: "bookingId",
                      key: "bookingId",
                      render: (id: number) => (
                        <div>
                          <strong>#{id}</strong>
                        </div>
                      )
                    },
                    {
                      title: "Số tiền hoàn",
                      key: "amount",
                      render: (_: unknown, record: RefundRow) => (
                        <div>
                          <strong style={{ color: "#b45309" }}>
                            {new Intl.NumberFormat("vi-VN").format(Number(record.amount))}₫
                          </strong>
                          <div style={{ fontSize: 12, color: "#999" }}>
                            {Math.round(Number(record.refundRate) * 100)}% của{" "}
                            {new Intl.NumberFormat("vi-VN").format(Number(record.paidAmount))}₫ đã trả
                          </div>
                        </div>
                      )
                    },
                    {
                      title: "Nhận tiền",
                      key: "method",
                      render: (_: unknown, record: RefundRow) =>
                        record.refundMethod === "cash" ? (
                          <Tag>Tiền mặt tại quầy</Tag>
                        ) : (
                          <div style={{ fontSize: 13 }}>
                            <div><strong>{record.bankName || "-"}</strong></div>
                            <div>{record.accountNumber}</div>
                            <div style={{ color: "#999" }}>{record.accountName}</div>
                          </div>
                        )
                    },
                    {
                      title: "Ngày yêu cầu",
                      dataIndex: "createdAt",
                      key: "createdAt",
                      render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm")
                    },
                    {
                      title: "Trạng thái",
                      key: "status",
                      render: (_: unknown, record: RefundRow) => (
                        <div>
                          <Tag
                            color={
                              record.status === "pending"
                                ? "gold"
                                : record.status === "approved"
                                  ? "green"
                                  : "red"
                            }
                          >
                            {record.status === "pending"
                              ? "Chờ duyệt"
                              : record.status === "approved"
                                ? "Đã hoàn tiền"
                                : "Từ chối"}
                          </Tag>
                          {record.processedAt && (
                            <div style={{ fontSize: 12, color: "#999" }}>
                              {dayjs(record.processedAt).format("DD/MM/YYYY HH:mm")}
                            </div>
                          )}
                          {record.note && (
                            <div style={{ fontSize: 12, color: "#999", maxWidth: 200 }}>{record.note}</div>
                          )}
                        </div>
                      )
                    }
                  ]}
                />

                <Modal
                  title="Rút tiền từ ví"
                  open={withdrawOpen}
                  okText="Gửi yêu cầu rút"
                  cancelText="Đóng"
                  confirmLoading={withdrawSubmitting}
                  onOk={handleWithdraw}
                  onCancel={() => !withdrawSubmitting && setWithdrawOpen(false)}
                  destroyOnHidden
                  centered
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <Text type="secondary">
                        Số dư khả dụng:{" "}
                        <strong style={{ color: "#15803d" }}>
                          {new Intl.NumberFormat("vi-VN").format(walletBalance.available)}₫
                        </strong>
                      </Text>
                    </div>

                    <div>
                      <div style={{ marginBottom: 6 }}>Số tiền muốn rút</div>
                      <InputNumber
                        style={{ width: "100%" }}
                        min={1}
                        value={withdrawAmount}
                        onChange={(value) => setWithdrawAmount(Number(value) || 0)}
                        formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                        parser={(value) => Number((value || "0").replace(/\./g, ""))}
                        addonAfter="₫"
                        status={withdrawAmount > walletBalance.available ? "error" : undefined}
                      />
                      {withdrawAmount > walletBalance.available && (
                        <div
                          style={{
                            color: "#ff4d4f",
                            fontSize: 13,
                            marginTop: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#fff2f0",
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: "1px solid #ffccc7",
                          }}
                        >
                          <ExclamationCircleOutlined style={{ color: "#ff4d4f", fontSize: 15 }} />
                          <span>
                            Số dư không đủ để rút. Vui lòng nhập số tiền nhỏ hơn hoặc bằng số dư hiện có (
                            <strong>{new Intl.NumberFormat("vi-VN").format(walletBalance.available)}₫</strong>).
                          </span>
                        </div>
                      )}
                    </div>

                    <Radio.Group
                      value={withdrawMethod}
                      onChange={(e) => setWithdrawMethod(e.target.value)}
                      options={[
                        { value: "bank_transfer", label: "Chuyển khoản ngân hàng" },
                        { value: "cash", label: "Nhận tiền mặt tại quầy" }
                      ]}
                    />

                    {withdrawMethod === "bank_transfer" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <Select
                          showSearch
                          placeholder="Chọn ngân hàng nhận tiền"
                          optionFilterProp="label"
                          value={withdrawBankBin}
                          onChange={setWithdrawBankBin}
                          options={VIETQR_BANKS.map((bank) => ({
                            value: bank.bin,
                            label: `${bank.shortName} — ${bank.name}`
                          }))}
                        />
                        <Input
                          placeholder="Số tài khoản nhận tiền (chỉ nhập số 0-9)"
                          maxLength={30}
                          value={withdrawAccountNumber}
                          onChange={(e) => setWithdrawAccountNumber(e.target.value.replace(/\D/g, ""))}
                        />
                        <Input
                          placeholder="Tên chủ tài khoản (VD: NGUYEN VAN A)"
                          maxLength={50}
                          value={withdrawAccountName}
                          onChange={(e) => setWithdrawAccountName(e.target.value)}
                        />
                      </div>
                    )}

                    {withdrawMethod === "cash" && (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        Bạn sẽ nhận tiền mặt tại quầy lễ tân sau khi yêu cầu được duyệt, vui lòng mang giấy tờ tùy thân.
                      </Text>
                    )}
                  </div>
                </Modal>
              </div>
            )}

            {/* TAB: THÔNG BÁO CỦA TÔI */}
            {activeTab === "notifications" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <Title level={3} style={{ margin: 0, color: "#2b2420" }}>Thông báo của tôi</Title>
                  {unreadNotifCount > 0 && (
                    <Button
                      type="link"
                      onClick={async () => {
                        await markAllNotificationsRead();
                        setProfileNotifications((prev) => prev.map((n) => ({ ...n, isRead: 1 })));
                        setUnreadNotifCount(0);
                        message.success("Đã đánh dấu tất cả thông báo là đã đọc");
                      }}
                    >
                      Đánh dấu tất cả đã đọc
                    </Button>
                  )}
                </div>

                <List
                  loading={notificationsLoading}
                  dataSource={profileNotifications}
                  locale={{ emptyText: <Empty description="Bạn chưa có thông báo nào" /> }}
                  renderItem={(item) => {
                    const isUnread = !item.isRead;
                    const isVoucher = item.type === "voucher" || item.referenceType === "voucher";
                    return (
                      <List.Item
                        key={item.id}
                        style={{
                          padding: "14px 16px",
                          marginBottom: "8px",
                          borderRadius: "8px",
                          backgroundColor: isUnread ? "#f0f7ff" : "#fbfbfb",
                          border: isUnread ? "1px solid #bae0ff" : "1px solid #f0f0f0",
                          cursor: isUnread ? "pointer" : "default",
                        }}
                        onClick={async () => {
                          if (isUnread) {
                            try {
                              await markNotificationRead(item.id);
                              setProfileNotifications((prev) =>
                                prev.map((n) => (n.id === item.id ? { ...n, isRead: 1 } : n))
                              );
                              setUnreadNotifCount((prev) => Math.max(0, prev - 1));
                            } catch {
                              // Ignored
                            }
                          }
                          if (isVoucher) {
                            setActiveTab("vouchers");
                            setSearchParams({ tab: "vouchers" });
                            fetchVouchers();
                          } else if (item.type === "booking" || item.referenceType === "booking") {
                            if (item.referenceId) {
                              navigate(`/booking/${item.referenceId}`);
                            } else {
                              setActiveTab("bookings");
                              setSearchParams({ tab: "bookings" });
                            }
                          } else if (item.type === "review" || item.referenceType === "review") {
                            navigate("/reviews");
                          }
                        }}
                      >
                        <List.Item.Meta
                          avatar={
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                backgroundColor: isVoucher ? "#fef3c7" : "#e0f2fe",
                                color: isVoucher ? "#d97706" : "#0284c7",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 16,
                              }}
                            >
                              {isVoucher ? <GiftOutlined /> : <InfoCircleOutlined />}
                            </div>
                          }
                          title={
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontWeight: isUnread ? 700 : 500, fontSize: 14 }}>
                                {item.title}
                              </span>
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                                {dayjs(item.createdAt).format("DD/MM/YYYY HH:mm")}
                              </span>
                            </div>
                          }
                          description={
                            <div style={{ marginTop: 4, color: "#475467", fontSize: 13 }}>
                              {item.content}
                            </div>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              </div>
            )}

            {/* TAB: ĐỔI MẬT KHẨU */}
            {activeTab === "change-password" && (
              <div style={{ maxWidth: "450px" }}>
                <Title level={3} style={{ marginBottom: "24px", color: "#2b2420" }}>Đổi mật khẩu tài khoản</Title>
                <Form
                  form={passwordForm}
                  layout="vertical"
                  onFinish={async (values) => {
                    try {
                      await api.post("/auth/change-password", {
                        oldPassword: values.oldPassword,
                        newPassword: values.newPassword
                      });
                      message.success("Đổi mật khẩu thành công!");
                      passwordForm.resetFields();
                    } catch (error: any) {
                      message.error(error.response?.data?.message || "Đổi mật khẩu thất bại!");
                    }
                  }}
                >
                  <Form.Item name="oldPassword" label="Mật khẩu cũ" rules={[{ required: true, message: "Vui lòng nhập mật khẩu cũ" }]}>
                    <Input.Password size="large" placeholder="Nhập mật khẩu cũ" />
                  </Form.Item>
                  <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true, message: "Vui lòng nhập mật khẩu mới (tối thiểu 6 ký tự)" }, { min: 6, message: "Mật khẩu tối thiểu 6 ký tự" }]}>
                    <Input.Password size="large" placeholder="Nhập mật khẩu mới" />
                  </Form.Item>
                  <Form.Item
                    name="confirmPassword"
                    label="Xác nhận mật khẩu mới"
                    dependencies={["newPassword"]}
                    rules={[
                      { required: true, message: "Vui lòng xác nhận mật khẩu mới" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("newPassword") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("Mật khẩu xác nhận không khớp!"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password size="large" placeholder="Xác nhận mật khẩu mới" />
                  </Form.Item>
                  <Form.Item style={{ marginTop: "24px" }}>
                    <Button type="primary" htmlType="submit" size="large" style={{ backgroundColor: "#ab8965", borderColor: "#ab8965", width: "100%" }}>
                      Thay đổi mật khẩu
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            )}

          </Card>
        </Col>

      </Row>
    </div>
  );
}

export default Profile;
