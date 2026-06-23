import { useEffect, useMemo, useState } from 'react';
import ReactApexChart from 'react-apexcharts';
import { ConfigProvider, Segmented, Row, Col, Skeleton } from 'antd';
import {
  DollarCircleOutlined,
  CalendarOutlined,
  UserAddOutlined,
  ApartmentOutlined
} from '@ant-design/icons';
import EmptyState from '../../components/Common/EmptyState';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Tông màu thương hiệu hiện có của hệ thống (đồng bộ với trang Quản lý khách hàng)
const brand = {
  primary: '#a78362',
  primaryDark: '#8c6d4a',
  accent: '#c9a063',
  accentBg: '#fbf3e6',
  success: '#3f8f5f',
  successBg: '#eaf3ec',
  danger: '#bb4a3c',
  dangerBg: '#fbece9',
  teal: '#3f7f78',
  tealBg: '#eaf2f1',
  page: '#f8f6f2',
  border: '#ece6db',
  textPrimary: '#2b2420',
  textSecondary: '#8d8478'
};

type StatsResponse = {
  ok: boolean;
  range: { from: string; to: string };
  mode: string;
  kpis: {
    revenueTotal: number;
    bookingsTotal: number;
    newCustomers: number;
    occupancyRate: number;
  };
  revenueSeries: { categories: string[]; data: number[] };
  bookingSeries: { categories: string[]; data: number[] };
  paymentMethodDonut: { labels: string[]; data: number[] };
  topRoomTypes: { labels: string[]; data: number[] };
};

type Mode = 'month' | 'year';

const formatVND = (value: number) => {
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${value}`;
  }
};

const formatCompactVND = (value: number) => {
  try {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(value);
  } catch {
    return `${value}`;
  }
};

function KpiCard({
  icon,
  label,
  value,
  color,
  bg
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${brand.border}`,
        borderRadius: 12,
        padding: '18px 18px 16px',
        height: '100%'
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 17,
          marginBottom: 12
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: brand.textPrimary, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: brand.textSecondary, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function CardPanel({
  title,
  tag,
  children
}: {
  title: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${brand.border}`,
        borderRadius: 12,
        padding: '16px 18px',
        height: '100%'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 12,
          marginBottom: 8,
          borderBottom: `1px solid ${brand.border}`
        }}
      >
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: brand.textPrimary }}>{title}</h2>
        <span
          style={{
            fontSize: 11,
            color: brand.textSecondary,
            border: `1px solid ${brand.border}`,
            borderRadius: 999,
            padding: '2px 10px'
          }}
        >
          {tag}
        </span>
      </div>
      {children}
    </div>
  );
}

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [mode, setMode] = useState<Mode>('month');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        const url = new URL(`${API_BASE}/dashboard`);
        url.searchParams.set('mode', mode);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as StatsResponse;
        if (!alive) return;

        if (!json.ok) throw new Error('API trả về ok=false');

        setData(json);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Lỗi không xác định');
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [mode, reloadKey]);

  const hasSeries =
    !!data &&
    ((data.revenueSeries?.data?.length ?? 0) > 0 || (data.bookingSeries?.data?.length ?? 0) > 0);

  const revenueChartOptions = useMemo(() => {
    return {
      chart: { type: 'area', height: 300, toolbar: { show: false } },
      colors: [brand.primary],
      stroke: { width: 3, curve: 'smooth' },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] }
      },
      dataLabels: { enabled: false },
      grid: { borderColor: brand.border, strokeDashArray: 4 },
      xaxis: {
        categories: data?.revenueSeries?.categories ?? [],
        labels: { style: { colors: brand.textSecondary, fontSize: '11px' } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          style: { colors: brand.textSecondary, fontSize: '11px' },
          formatter: (v: number) => formatCompactVND(v)
        }
      },
      tooltip: { y: { formatter: (v: number) => formatVND(v) } }
    } satisfies ApexCharts.ApexOptions;
  }, [data]);

  const revenueChartSeries = useMemo(
    () => [{ name: 'Doanh thu', data: data?.revenueSeries?.data ?? [] }],
    [data]
  );

  const bookingChartOptions = useMemo(() => {
    return {
      chart: { type: 'bar', height: 300, toolbar: { show: false } },
      colors: [brand.teal],
      plotOptions: { bar: { borderRadius: 5, columnWidth: '42%' } },
      dataLabels: { enabled: false },
      grid: { borderColor: brand.border, strokeDashArray: 4 },
      xaxis: {
        categories: data?.bookingSeries?.categories ?? [],
        labels: { style: { colors: brand.textSecondary, fontSize: '11px' } },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: { labels: { style: { colors: brand.textSecondary, fontSize: '11px' } } },
      tooltip: { y: { formatter: (v: number) => `${v} booking` } }
    } satisfies ApexCharts.ApexOptions;
  }, [data]);

  const bookingChartSeries = useMemo(
    () => [{ name: 'Số booking', data: data?.bookingSeries?.data ?? [] }],
    [data]
  );

  const paymentDonutOptions = useMemo(() => {
    return {
      chart: { type: 'donut', height: 300 },
      labels: data?.paymentMethodDonut?.labels ?? [],
      colors: [brand.primary, brand.teal, brand.accent, brand.success, brand.danger],
      dataLabels: { enabled: true, style: { fontSize: '11px' } },
      stroke: { width: 2, colors: ['#fff'] },
      legend: { position: 'bottom', fontSize: '12px', labels: { colors: brand.textPrimary } },
      tooltip: { y: { formatter: (v: number) => `${v} giao dịch` } }
    } satisfies ApexCharts.ApexOptions;
  }, [data]);

  const paymentDonutSeries = useMemo(() => data?.paymentMethodDonut?.data ?? [], [data]);

  const periodLabel = useMemo(() => {
    if (!data?.range?.from) return '';
    const from = new Date(data.range.from);
    if (data.mode === 'year') return `Năm ${from.getFullYear()}`;
    return `Tháng ${from.getMonth() + 1}/${from.getFullYear()}`;
  }, [data]);

  const topRoomTypes = useMemo(() => {
    const labels = data?.topRoomTypes?.labels ?? [];
    const values = data?.topRoomTypes?.data ?? [];
    const max = Math.max(1, ...values);
    return labels.map((label, idx) => ({
      label,
      value: values[idx] ?? 0,
      pct: Math.round(((values[idx] ?? 0) / max) * 100)
    }));
  }, [data]);

  const kpiDefs = data
    ? [
        {
          icon: <DollarCircleOutlined />,
          label: 'Tổng doanh thu',
          value: formatVND(data.kpis?.revenueTotal ?? 0),
          color: brand.primaryDark,
          bg: '#f4ece1'
        },
        {
          icon: <CalendarOutlined />,
          label: 'Tổng số booking',
          value: data.kpis?.bookingsTotal ?? 0,
          color: brand.teal,
          bg: brand.tealBg
        },
        {
          icon: <UserAddOutlined />,
          label: 'Khách hàng mới',
          value: data.kpis?.newCustomers ?? 0,
          color: brand.success,
          bg: brand.successBg
        },
        {
          icon: <ApartmentOutlined />,
          label: 'Tỷ lệ lấp đầy',
          value: `${data.kpis?.occupancyRate ?? 0}%`,
          color: brand.accent,
          bg: brand.accentBg
        }
      ]
    : [];

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: brand.primary, borderRadius: 10, fontSize: 14 }
      }}
    >
      <div style={{ background: brand.page, minHeight: '100%', padding: 28, borderRadius: 16 }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 24
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: brand.accent,
                marginBottom: 6
              }}
            >
              Tổng quan vận hành
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: brand.textPrimary }}>
              Dashboard & Thống kê
            </h1>
            <p style={{ margin: '4px 0 0', color: brand.textSecondary, fontSize: 14, maxWidth: 480 }}>
              Doanh thu, booking, khách hàng mới và tỷ lệ lấp đầy phòng theo kỳ báo cáo.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {periodLabel && (
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: brand.primaryDark,
                  background: '#f4ece1',
                  border: `1px solid ${brand.border}`,
                  borderRadius: 999,
                  padding: '6px 14px'
                }}
              >
                {periodLabel}
              </span>
            )}

            <Segmented
              value={mode}
              onChange={(value) => setMode(value as Mode)}
              options={[
                { label: 'Tháng hiện tại', value: 'month' },
                { label: 'Năm nay', value: 'year' }
              ]}
            />
          </div>
        </div>

        {/* KPIs */}
        {loading && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Col xs={24} sm={12} lg={6} key={i}>
                <div style={{ background: '#fff', border: `1px solid ${brand.border}`, borderRadius: 12, padding: 18 }}>
                  <Skeleton active title={false} paragraph={{ rows: 2, width: ['60%', '40%'] }} />
                </div>
              </Col>
            ))}
          </Row>
        )}

        {!loading && error && (
          <div
            style={{
              background: '#fff',
              border: `1px solid ${brand.border}`,
              borderRadius: 12,
              padding: 32,
              textAlign: 'center'
            }}
          >
            <h2 style={{ margin: '0 0 8px', color: brand.textPrimary }}>Không thể tải dashboard</h2>
            <p style={{ margin: '0 0 16px', color: brand.textSecondary }}>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 10,
                border: 'none',
                background: brand.primary,
                color: '#fff',
                fontWeight: 600,
              }}
            >
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && !data && (
          <EmptyState title="Không có dữ liệu" message="Không có dữ liệu trong khoảng thời gian này." />
        )}

        {!loading && data && (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              {kpiDefs.map((kpi) => (
                <Col xs={24} sm={12} lg={6} key={kpi.label}>
                  <KpiCard {...kpi} />
                </Col>
              ))}
            </Row>

            {!hasSeries && (
              <p style={{ fontSize: 13, color: brand.textSecondary, margin: '0 0 16px' }}>
                Không có dữ liệu trong khoảng thời gian này.
              </p>
            )}

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col xs={24} lg={12}>
                <CardPanel title="Doanh thu theo thời gian" tag="Đường">
                  <ReactApexChart
                    options={revenueChartOptions}
                    series={revenueChartSeries as any}
                    type="area"
                    height={300}
                  />
                </CardPanel>
              </Col>

              <Col xs={24} lg={12}>
                <CardPanel title="Số lượng booking" tag="Cột">
                  <ReactApexChart
                    options={bookingChartOptions}
                    series={bookingChartSeries as any}
                    type="bar"
                    height={300}
                  />
                </CardPanel>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <CardPanel title="Hình thức thanh toán" tag="Tỷ trọng">
                  <ReactApexChart
                    options={paymentDonutOptions}
                    series={paymentDonutSeries as any}
                    type="donut"
                    height={300}
                  />
                </CardPanel>
              </Col>

              <Col xs={24} lg={12}>
                <CardPanel title="Loại phòng được đặt nhiều" tag="Xếp hạng">
                  {topRoomTypes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0 8px' }}>
                      {topRoomTypes.map((row, idx) => (
                        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              flex: '0 0 auto',
                              width: 26,
                              height: 26,
                              borderRadius: 7,
                              background: brand.primary,
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: 12.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {idx + 1}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 8,
                                fontSize: 13,
                                marginBottom: 6
                              }}
                            >
                              <span
                                style={{
                                  color: brand.textPrimary,
                                  fontWeight: 500,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {row.label}
                              </span>
                              <span style={{ color: brand.textSecondary, flex: '0 0 auto' }}>{row.value}</span>
                            </div>
                            <div style={{ height: 6, background: '#f1efe9', borderRadius: 999, overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${row.pct}%`,
                                  borderRadius: 999,
                                  background: `linear-gradient(90deg, ${brand.primary}, ${brand.teal})`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: brand.textSecondary, padding: '8px 0' }}>Chưa có dữ liệu.</p>
                  )}
                </CardPanel>
              </Col>
            </Row>
          </>
        )}
      </div>
    </ConfigProvider>
  );
}

export default AdminDashboard;
