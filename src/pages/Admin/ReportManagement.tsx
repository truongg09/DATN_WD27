import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Select,
  Typography,
  message,
  Tag,
} from 'antd';
import {
  FileExcelOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  FallOutlined,
  DollarCircleOutlined,
  CalendarOutlined,
  HomeOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../services/api';
import './ReportManagement.css';

const { Text } = Typography;
const { Option } = Select;

// ---- Kiểu dữ liệu khớp với response thật của API /api/reports/monthly ----
interface MonthlyReport {
  month: number;
  label: string;
  bookingsCount: number;
  cancelledCount: number;
  roomRevenue: number;
  serviceRevenue: number;
  surchargeRevenue?: number;
  discountAmount?: number;
  retainedCancellationRevenue?: number;
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

const paymentMethodLabel: Record<string, string> = {
  cash: 'Tiền mặt',
  bank_transfer: 'Chuyển khoản QR',
  zalopay: 'ZaloPay',
  vnpay: 'VNPay',
  wallet: 'Ví số dư HotelHub',
};

interface ReportSummary {
  totalRevenue: number;
  totalRoomRevenue?: number;
  totalServiceRevenue?: number;
  totalSurchargeRevenue?: number;
  totalDiscountAmount?: number;
  totalRetainedCancellationRevenue?: number;
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

const formatPercent = (val: number) =>
  new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(val) || 0);

const CURRENT_YEAR = new Date().getFullYear();
// Danh sách năm động: 2 năm trước tới năm hiện tại, thay vì hardcode 2024/2025/2026
const YEAR_OPTIONS = Array.from({ length: 3 }, (_, i) => CURRENT_YEAR - 2 + i);

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
          `${formatPercent(m.occupancyRate)}%`
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [171, 137, 101] }
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
      title: 'Tổng doanh thu',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      render: (val: number) => <strong>{formatVND(val)}</strong>
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
      render: (val: number) => <Text type={val > 50 ? 'success' : 'warning'}>{formatPercent(val)}%</Text>
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
    {
      title: 'Phương thức',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => paymentMethodLabel[method] || method,
    },
    { title: 'Số giao dịch', dataIndex: 'transactionCount', key: 'transactionCount' },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => formatVND(val)
    }
  ];

  const occupancyOk = (summary?.avgOccupancyRate || 0) > 50;

  return (
    <main className="report-mgmt-page">
      <section className="report-mgmt-shell">
        <div className="report-mgmt-hero">
          <div>
            <span className="report-mgmt-eyebrow">HotelHub · Admin</span>
            <h1>Báo cáo &amp; Thống kê tài chính</h1>
            <p>Phân tích tình hình kinh doanh theo năm, dữ liệu thời gian thực từ hệ thống.</p>
          </div>
          <div className="report-mgmt-toolbar">
            <Select
              value={year}
              onChange={setYear}
              style={{ width: 130 }}
              suffixIcon={<CalendarOutlined />}
            >
              {YEAR_OPTIONS.map((y) => (
                <Option key={y} value={y}>Năm {y}</Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={fetchReportData} loading={loading}>
              Làm mới
            </Button>
            <Button
              className="report-export-pdf-btn"
              icon={<FilePdfOutlined />}
              onClick={handleExportPDF}
              loading={exporting}
            >
              Xuất PDF
            </Button>
            <Button
              className="report-export-excel-btn"
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              loading={exporting}
            >
              Xuất Excel
            </Button>
          </div>
        </div>

        <div className="report-mgmt-stats">
          <div className="report-stat-card">
            <span className="report-stat-label">
              <DollarCircleOutlined /> Tổng doanh thu
            </span>
            <div className="report-stat-value">
              {(summary?.totalRevenue || 0).toLocaleString('vi-VN')}
              <span className="unit">₫</span>
            </div>
            <span className="report-stat-sub">Đã thu: {formatVND(summary?.totalPaid || 0)}</span>
          </div>

          <div className="report-stat-card">
            <span className="report-stat-label">
              <CreditCardOutlined /> Công nợ còn lại
            </span>
            <div className={`report-stat-value ${summary?.totalOutstanding ? 'is-danger' : 'is-success'}`}>
              {summary?.totalOutstanding ? <FallOutlined style={{ fontSize: 16 }} /> : null}
              {(summary?.totalOutstanding || 0).toLocaleString('vi-VN')}
              <span className="unit">₫</span>
            </div>
            <span className="report-stat-sub">
              {summary?.totalOutstanding ? 'Cần thu hồi từ khách' : 'Không có công nợ'}
            </span>
          </div>

          <div className="report-stat-card">
            <span className="report-stat-label">
              <CalendarOutlined /> Tổng đơn đặt phòng
            </span>
            <div className="report-stat-value is-info">
              {summary?.totalBookings || 0}
              <span className="unit">đơn</span>
            </div>
            <span className="report-stat-sub">Tỷ lệ hủy/no-show: {summary?.cancelRate || 0}%</span>
          </div>

          <div className="report-stat-card">
            <span className="report-stat-label">
              <HomeOutlined /> Công suất phòng TB
            </span>
            <div className={`report-stat-value ${occupancyOk ? 'is-success' : 'is-warning'}`}>
              {formatPercent(summary?.avgOccupancyRate || 0)}
              <span className="unit">%</span>
            </div>
            <span className="report-stat-sub">Khách hàng mới: {summary?.newCustomers || 0}</span>
          </div>
        </div>

        <div className="report-table-panel">
          <div className="report-table-header">
            <h2>Bảng tổng hợp chi tiết năm {year}</h2>
          </div>
          <Table
            className="report-mgmt-table"
            columns={columns}
            dataSource={monthlyData}
            rowKey="month"
            loading={loading}
            pagination={false}
            scroll={{ x: 900 }}
            size="middle"
            summary={(pageData) => {
              let totalRoom = 0, totalService = 0, totalRevenue = 0, totalPaid = 0, totalRemaining = 0, totalBookings = 0, totalCancelled = 0;
              pageData.forEach((r) => {
                totalRoom += r.roomRevenue;
                totalService += r.serviceRevenue;
                totalRevenue += r.totalRevenue;
                totalPaid += r.paidAmount;
                totalRemaining += r.remainingAmount;
                totalBookings += r.bookingsCount;
                totalCancelled += r.cancelledCount;
              });
              return (
                <Table.Summary.Row className="report-summary-row">
                  <Table.Summary.Cell index={0} align="left">Tổng cộng</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>{formatVND(totalRoom)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>{formatVND(totalService)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3}><strong>{formatVND(totalRevenue)}</strong></Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>{formatVND(totalPaid)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>{formatVND(totalRemaining)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={6}>{totalBookings} đơn</Table.Summary.Cell>
                  <Table.Summary.Cell index={7}>{totalCancelled}</Table.Summary.Cell>
                  <Table.Summary.Cell index={8}>{formatPercent(summary?.avgOccupancyRate || 0)}%</Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        </div>

        <div className="report-breakdown-grid">
          <div className="report-table-panel">
            <div className="report-table-header">
              <h2>Doanh thu theo loại phòng</h2>
            </div>
            <Table
              className="report-mgmt-table"
              columns={roomTypeColumns}
              dataSource={byRoomType}
              rowKey="roomType"
              loading={loading}
              pagination={false}
              size="small"
            />
          </div>

          <div className="report-table-panel">
            <div className="report-table-header">
              <h2>Doanh thu theo phương thức thanh toán</h2>
            </div>
            <Table
              className="report-mgmt-table"
              columns={paymentMethodColumns}
              dataSource={byPaymentMethod}
              rowKey="method"
              loading={loading}
              pagination={false}
              size="small"
            />
          </div>
        </div>
      </section>
    </main>
  );
}

export default ReportManagement;
