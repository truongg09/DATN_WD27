import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Select,
  Typography,
  Space,
  message,
  Statistic,
  Tag,
  Divider,
  Avatar
} from 'antd';
import {
  FileExcelOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  HomeOutlined,
  CreditCardOutlined,
  PieChartOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

// ---- Kiểu dữ liệu khớp với response thật của API /api/reports/monthly ----
interface MonthlyReport {
  month: number;
  label: string;
  bookingsCount: number;
  cancelledCount: number;
  roomRevenue: number;
  serviceRevenue: number;
  totalRevenue: number;
  paidAmount: number;
  remainingAmount: number;
  newCustomers: number;
  occupancyRate: number;
}

interface RoomTypeBreakdown {
  roomType: string;
  bookingsCount: number;
  revenue: number;
}

interface PaymentMethodBreakdown {
  method: string;
  transactionCount: number;
  amount: number;
}

interface ReportSummary {
  totalRevenue: number;
  totalPaid: number;
  totalOutstanding: number;
  totalBookings: number;
  totalCancelled: number;
  cancelRate: number;
  newCustomers: number;
  avgOccupancyRate: number;
  totalDamageFees: number;
}

const formatVND = (val: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

const CURRENT_YEAR = new Date().getFullYear();
// Danh sách năm động: 2 năm trước tới năm hiện tại, thay vì hardcode 2024/2025/2026
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - 2 + i);

// Style dùng chung cho mọi Card để đồng bộ bo góc + đổ bóng nhẹ, không đổi bảng màu hiện có
const CARD_STYLE: CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
};

const STAT_CARD_STYLE: CSSProperties = {
  ...CARD_STYLE,
  height: '100%'
};

function ReportManagement() {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyReport[]>([]);
  const [byRoomType, setByRoomType] = useState<RoomTypeBreakdown[]>([]);
  const [byPaymentMethod, setByPaymentMethod] = useState<PaymentMethodBreakdown[]>([]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/reports/monthly?year=${year}`);
      const resData = response.data || response;

      if (resData.ok) {
        setSummary(resData.summary);
        setMonthlyData(resData.monthly || []);
        setByRoomType(resData.byRoomType || []);
        setByPaymentMethod(resData.byPaymentMethod || []);
      } else {
        message.error('Không tải được dữ liệu báo cáo');
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
      message.error('Lỗi khi tải dữ liệu báo cáo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // ---- XUẤT EXCEL THẬT (dùng thư viện xlsx / SheetJS) ----
  // Cần cài: npm install xlsx
  const handleExportExcel = () => {
    if (monthlyData.length === 0) {
      message.warning('Chưa có dữ liệu để xuất');
      return;
    }
    setExporting(true);
    try {
      const rows = monthlyData.map((m) => ({
        'Thời gian': m.label,
        'Doanh thu phòng (VNĐ)': m.roomRevenue,
        'Doanh thu dịch vụ (VNĐ)': m.serviceRevenue,
        'Tổng doanh thu': formatVND(m.totalRevenue),
        'Đã thu (VNĐ)': m.paidAmount,
        'Còn nợ (VNĐ)': m.remainingAmount,
        'Số đơn đặt': m.bookingsCount,
        'Đơn hủy/no-show': m.cancelledCount,
        'Khách hàng mới': m.newCustomers,
        'Công suất phòng (%)': m.occupancyRate
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 18 },
        { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 16 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Năm ${year}`);

      // Thêm sheet phụ: theo loại phòng
      if (byRoomType.length > 0) {
        const roomTypeSheet = XLSX.utils.json_to_sheet(
          byRoomType.map((r) => ({
            'Loại phòng': r.roomType,
            'Số đơn': r.bookingsCount,
            'Doanh thu (VNĐ)': r.revenue
          }))
        );
        XLSX.utils.book_append_sheet(workbook, roomTypeSheet, 'Theo loại phòng');
      }

      // Thêm sheet phụ: theo phương thức thanh toán
      if (byPaymentMethod.length > 0) {
        const paymentSheet = XLSX.utils.json_to_sheet(
          byPaymentMethod.map((p) => ({
            'Phương thức': p.method,
            'Số giao dịch': p.transactionCount,
            'Số tiền (VNĐ)': p.amount
          }))
        );
        XLSX.utils.book_append_sheet(workbook, paymentSheet, 'Theo thanh toán');
      }

      XLSX.writeFile(workbook, `Bao_cao_khach_san_${year}.xlsx`);
      message.success(`Đã xuất file Bao_cao_khach_san_${year}.xlsx`);
    } catch (error) {
      console.error('Export Excel error:', error);
      message.error('Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  };

  // ---- XUẤT PDF THẬT (dùng jsPDF + jspdf-autotable) ----
  // Cần cài: npm install jspdf jspdf-autotable
  const handleExportPDF = () => {
    if (monthlyData.length === 0) {
      message.warning('Chưa có dữ liệu để xuất');
      return;
    }
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(14);
      doc.text(`Bao cao doanh thu & hoat dong - Nam ${year}`, 14, 15);
      doc.setFontSize(10);
      doc.text(
        `Tong doanh thu: ${formatVND(summary?.totalRevenue || 0)}  |  Da thu: ${formatVND(
          summary?.totalPaid || 0
        )}  |  Cong no: ${formatVND(summary?.totalOutstanding || 0)}`,
        14,
        22
      );

      autoTable(doc, {
        startY: 28,
        head: [[
          'Thoi gian', 'DT phong', 'DT dich vu', 'Tong DT',
          'Da thu', 'Con no', 'So don', 'Huy/No-show', 'Cong suat (%)'
        ]],
        body: monthlyData.map((m) => [
          m.label,
          formatVND(m.roomRevenue),
          formatVND(m.serviceRevenue),
          formatVND(m.totalRevenue),
          formatVND(m.paidAmount),
          formatVND(m.remainingAmount),
          String(m.bookingsCount),
          String(m.cancelledCount),
          `${m.occupancyRate}%`
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [46, 125, 50] }
      });

      doc.save(`Bao_cao_khach_san_${year}.pdf`);
      message.success(`Đã xuất file Bao_cao_khach_san_${year}.pdf`);
    } catch (error) {
      console.error('Export PDF error:', error);
      message.error('Xuất PDF thất bại');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'label',
      key: 'label',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Doanh thu phòng',
      dataIndex: 'roomRevenue',
      key: 'roomRevenue',
      render: (val: number) => formatVND(val)
    },
    {
      title: 'Doanh thu dịch vụ',
      dataIndex: 'serviceRevenue',
      key: 'serviceRevenue',
      render: (val: number) => formatVND(val)
    },
    {
      title: 'Đã thu',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      render: (val: number) => <Text type="success">{formatVND(val)}</Text>
    },
    {
      title: 'Còn nợ',
      dataIndex: 'remainingAmount',
      key: 'remainingAmount',
      render: (val: number) =>
        val > 0 ? <Text type="danger">{formatVND(val)}</Text> : <Text type="secondary">-</Text>
    },
    {
      title: 'Số đơn',
      dataIndex: 'bookingsCount',
      key: 'bookingsCount',
      render: (val: number) => `${val} đơn`
    },
    {
      title: 'Hủy / No-show',
      dataIndex: 'cancelledCount',
      key: 'cancelledCount',
      render: (val: number) => (val > 0 ? <Tag color="red">{val}</Tag> : <Tag>0</Tag>)
    },
    {
      title: 'Công suất phòng',
      dataIndex: 'occupancyRate',
      key: 'occupancyRate',
      render: (val: number) => <Text type={val > 50 ? 'success' : 'warning'}>{val}%</Text>
    }
  ];

  const roomTypeColumns = [
    { title: 'Loại phòng', dataIndex: 'roomType', key: 'roomType' },
    { title: 'Số đơn', dataIndex: 'bookingsCount', key: 'bookingsCount' },
    {
      title: 'Doanh thu',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (val: number) => formatVND(val)
    }
  ];

  const paymentMethodColumns = [
    { title: 'Phương thức', dataIndex: 'method', key: 'method' },
    { title: 'Số giao dịch', dataIndex: 'transactionCount', key: 'transactionCount' },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => formatVND(val)
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <Card style={{ ...CARD_STYLE, marginBottom: 20 }} styles={{ body: { padding: '20px 24px' } }}>
        <Row justify="space-between" align="middle" gutter={[16, 12]}>
          <Col flex="auto">
            <Space align="center" size={10}>
              <BarChartOutlined style={{ fontSize: 20, color: '#8c8c8c' }} />
              <Title level={3} style={{ margin: 0 }}>Báo cáo & Thống kê tài chính</Title>
            </Space>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">
                Phân tích tình hình kinh doanh theo năm · dữ liệu thời gian thực từ hệ thống
              </Text>
            </div>
          </Col>
          <Col>
            <Space size={10} wrap>
              <Select value={year} onChange={setYear} style={{ width: 120 }} suffixIcon={<CalendarOutlined />}>
                {YEAR_OPTIONS.map((y) => (
                  <Option key={y} value={y}>Năm {y}</Option>
                ))}
              </Select>
              <Button icon={<ReloadOutlined />} onClick={fetchReportData} loading={loading}>
                Làm mới
              </Button>
              <Divider type="vertical" style={{ height: 24, margin: '0 2px' }} />
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                onClick={handleExportPDF}
                loading={exporting}
                danger
              >
                Xuất PDF
              </Button>
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
                loading={exporting}
                style={{ backgroundColor: '#2e7d32', borderColor: '#2e7d32' }}
              >
                Xuất Excel
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={STAT_CARD_STYLE} styles={{ body: { padding: 20 } }}>
            <Space align="start" size={14}>
              <Avatar
                shape="square"
                size={44}
                icon={<DollarCircleOutlined />}
                style={{ backgroundColor: 'rgba(63,134,0,0.1)', color: '#3f8600', borderRadius: 10 }}
              />
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>Tổng doanh thu</Text>
                <Statistic
                  value={summary?.totalRevenue || 0}
                  formatter={(value)=>Number(value).toLocaleString('vi-VN')}
                  suffix="₫"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Đã thu: {formatVND(summary?.totalPaid || 0)}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={STAT_CARD_STYLE} styles={{ body: { padding: 20 } }}>
            <Space align="start" size={14}>
              <Avatar
                shape="square"
                size={44}
                icon={<CreditCardOutlined />}
                style={{
                  backgroundColor: summary?.totalOutstanding ? 'rgba(207,19,34,0.1)' : 'rgba(63,134,0,0.1)',
                  color: summary?.totalOutstanding ? '#cf1322' : '#3f8600',
                  borderRadius: 10
                }}
              />
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>Công nợ còn lại</Text>
                <Statistic
                  value={summary?.totalOutstanding || 0}
                  precision={0}
                  styles={{
                    content: {
                      color: summary?.totalOutstanding ? '#cf1322' : '#3f8600',
                      fontSize: 22,
                      lineHeight: 1.3
                    }
                  }}
                  prefix={summary?.totalOutstanding ? <FallOutlined style={{ fontSize: 14 }} /> : undefined}
                  suffix="₫"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {summary?.totalOutstanding ? 'Cần thu hồi từ khách' : 'Không có công nợ'}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={STAT_CARD_STYLE} styles={{ body: { padding: 20 } }}>
            <Space align="start" size={14}>
              <Avatar
                shape="square"
                size={44}
                icon={<CalendarOutlined />}
                style={{ backgroundColor: 'rgba(43,108,176,0.1)', color: '#2b6cb0', borderRadius: 10 }}
              />
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>Tổng đơn đặt phòng</Text>
                <Statistic
                  value={summary?.totalBookings || 0}
                  styles={{ content: { color: '#2b6cb0', fontSize: 22, lineHeight: 1.3 } }}
                  suffix=" đơn"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tỷ lệ hủy/no-show: {summary?.cancelRate || 0}%
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={STAT_CARD_STYLE} styles={{ body: { padding: 20 } }}>
            <Space align="start" size={14}>
              <Avatar
                shape="square"
                size={44}
                icon={<HomeOutlined />}
                style={{ backgroundColor: 'rgba(214,158,46,0.12)', color: '#d69e2e', borderRadius: 10 }}
              />
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>Công suất phòng TB</Text>
                <Statistic
                  value={summary?.avgOccupancyRate || 0}
                  styles={{ content: { color: '#d69e2e', fontSize: 22, lineHeight: 1.3 } }}
                  suffix="%"
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Khách hàng mới: {summary?.newCustomers || 0}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space size={8}>
            <BarChartOutlined style={{ color: '#8c8c8c' }} />
            <span>Bảng tổng hợp chi tiết năm {year}</span>
          </Space>
        }
        style={{ ...CARD_STYLE, marginBottom: 20 }}
        styles={{ header: { borderBottom: '1px solid #f0f0f0' }, body: { paddingTop: 12 } }}
      >
        <Table
          columns={columns}
          dataSource={monthlyData}
          rowKey="month"
          loading={loading}
          pagination={false}
          scroll={{ x: 900 }}
          size="middle"
          summary={(pageData) => {
            let totalRoom = 0, totalService = 0, totalPaid = 0, totalRemaining = 0, totalBookings = 0, totalCancelled = 0;
            pageData.forEach((r) => {
              totalRoom += r.roomRevenue;
              totalService += r.serviceRevenue;
              totalPaid += r.paidAmount;
              totalRemaining += r.remainingAmount;
              totalBookings += r.bookingsCount;
              totalCancelled += r.cancelledCount;
            });
            return (
              <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                <Table.Summary.Cell index={0} align="left">Tổng cộng</Table.Summary.Cell>
                <Table.Summary.Cell index={1}>{formatVND(totalRoom)}</Table.Summary.Cell>
                <Table.Summary.Cell index={2}>{formatVND(totalService)}</Table.Summary.Cell>
                <Table.Summary.Cell index={3}>{formatVND(totalPaid)}</Table.Summary.Cell>
                <Table.Summary.Cell index={4}>{formatVND(totalRemaining)}</Table.Summary.Cell>
                <Table.Summary.Cell index={5}>{totalBookings} đơn</Table.Summary.Cell>
                <Table.Summary.Cell index={6}>{totalCancelled}</Table.Summary.Cell>
                <Table.Summary.Cell index={7}>-</Table.Summary.Cell>
              </Table.Summary.Row>
            );
          }}
        />
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} md={12}>
          <Card
            title={
              <Space size={8}>
                <PieChartOutlined style={{ color: '#8c8c8c' }} />
                <span>Doanh thu theo loại phòng</span>
              </Space>
            }
            style={CARD_STYLE}
            styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
          >
            <Table
              columns={roomTypeColumns}
              dataSource={byRoomType}
              rowKey="roomType"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={
              <Space size={8}>
                <CreditCardOutlined style={{ color: '#8c8c8c' }} />
                <span>Doanh thu theo phương thức thanh toán</span>
              </Space>
            }
            style={CARD_STYLE}
            styles={{ header: { borderBottom: '1px solid #f0f0f0' } }}
          >
            <Table
              columns={paymentMethodColumns}
              dataSource={byPaymentMethod}
              rowKey="method"
              loading={loading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default ReportManagement;