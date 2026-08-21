import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Select,
  Switch,
  Tag,
  Space,
  Card,
  Popconfirm,
  message,
  Typography,
  Tooltip,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export interface Holiday {
  id: number;
  name: string;
  calendarType: 'solar' | 'lunar_variable' | 'custom';
  year?: number | null;
  startDate: string;
  endDate: string;
  surchargePercent: number;
  isRecurring: boolean;
  description?: string | null;
  status: 'active' | 'inactive';
  created_at?: string;
}

const HolidayManagement: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [filterYear, setFilterYear] = useState<number | undefined>(undefined);
  const [filterDays, setFilterDays] = useState<'15' | '30' | '90' | 'all'>('90');

  const [form] = Form.useForm();

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterYear) params.year = filterYear;
      if (filterDays !== 'all') params.daysAhead = Number(filterDays);
      const res: any = await api.get('/holidays', { params });
      if (res?.data) {
        setHolidays(res.data);
      }
    } catch (err: any) {
      console.error('Lỗi khi tải lịch ngày lễ:', err);
      message.error(err?.response?.data?.message || 'Không thể tải danh sách ngày lễ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [filterYear, filterDays]);

  const handleOpenAddModal = () => {
    setEditingHoliday(null);
    form.resetFields();
    form.setFieldsValue({
      calendarType: 'solar',
      surchargePercent: 10,
      isRecurring: false,
      status: 'active',
      dateRange: [dayjs(), dayjs()]
    });
    setModalVisible(true);
  };

  const handleOpenEditModal = (record: Holiday) => {
    setEditingHoliday(record);
    form.setFieldsValue({
      name: record.name,
      calendarType: record.calendarType,
      year: record.year || undefined,
      dateRange: [dayjs(record.startDate), dayjs(record.endDate)],
      surchargePercent: record.surchargePercent,
      isRecurring: !!record.isRecurring,
      description: record.description,
      status: record.status
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/holidays/${id}`);
      message.success('Đã xóa ngày lễ');
      fetchHolidays();
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể xóa ngày lễ');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const [start, end] = values.dateRange;
      const startDate = start.format('YYYY-MM-DD');
      const endDate = end.format('YYYY-MM-DD');

      const payload = {
        name: values.name,
        calendarType: values.calendarType,
        year: values.year || Number(startDate.slice(0, 4)),
        startDate,
        endDate,
        surchargePercent: values.surchargePercent,
        isRecurring: values.isRecurring ? 1 : 0,
        description: values.description,
        status: values.status
      };

      if (editingHoliday) {
        await api.put(`/holidays/${editingHoliday.id}`, payload);
        message.success('Cập nhật ngày lễ thành công');
      } else {
        await api.post('/holidays', payload);
        message.success('Thêm mới ngày lễ thành công');
      }

      setModalVisible(false);
      fetchHolidays();
    } catch (err: any) {
      if (err?.errorFields) return; // Validation error
      message.error(err?.response?.data?.message || 'Có lỗi xảy ra khi lưu ngày lễ');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = holidays.filter((h) => h.status === 'active').length;
  const lunarCount = holidays.filter((h) => h.calendarType === 'lunar_variable').length;

  const columns = [
    {
      title: 'Tên ngày lễ / Tết',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Holiday) => (
        <div>
          <Text strong style={{ fontSize: 15, color: '#111827' }}>{text}</Text>
          {record.description && (
            <div style={{ color: '#6b7280', fontSize: 13 }}>{record.description}</div>
          )}
        </div>
      )
    },
    {
      title: 'Phân loại',
      dataIndex: 'calendarType',
      key: 'calendarType',
      width: 170,
      render: (type: string, record: Holiday) => {
        if (type === 'lunar_variable') {
          return <Tag color="gold" icon={<CalendarOutlined />}>Tết / Âm lịch ({record.year || 'Động'})</Tag>;
        }
        if (type === 'solar') {
          return <Tag color="blue">Dương lịch {record.isRecurring ? '(Hàng năm)' : ''}</Tag>;
        }
        return <Tag color="purple">Sự kiện đặc biệt</Tag>;
      }
    },
    {
      title: 'Khoảng thời gian (Dương lịch)',
      key: 'dateRange',
      width: 240,
      render: (_: any, record: Holiday) => {
        const start = dayjs(record.startDate).format('DD/MM/YYYY');
        const end = dayjs(record.endDate).format('DD/MM/YYYY');
        return (
          <div>
            <Text style={{ fontWeight: 500 }}>{start}</Text>
            <span style={{ margin: '0 6px', color: '#9ca3af' }}>→</span>
            <Text style={{ fontWeight: 500 }}>{end}</Text>
          </div>
        );
      }
    },
    {
      title: 'Phụ thu',
      dataIndex: 'surchargePercent',
      key: 'surchargePercent',
      width: 120,
      align: 'center' as const,
      render: (val: number) => (
        <Tag color="red" style={{ fontWeight: 600, fontSize: 13, padding: '2px 8px' }}>
          +{val}%
        </Tag>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => (
        status === 'active' ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>Kích hoạt</Tag>
        ) : (
          <Tag color="default" icon={<CloseCircleOutlined />}>Tạm ẩn</Tag>
        )
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      align: 'right' as const,
      render: (_: any, record: Holiday) => (
        <Space size="small">
          <Tooltip title="Sửa">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#2563eb' }} />}
              onClick={() => handleOpenEditModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa ngày lễ này?"
            description="Bạn có chắc chắn muốn xóa ngày lễ khỏi hệ thống?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xóa">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Quản lý Lịch Các Ngày Lễ & Tết</Title>
          <Text type="secondary">Cấu hình linh hoạt các đợt nghỉ lễ Tết và tỷ lệ phụ thu tiền phòng tự động</Text>
        </div>
        <Space wrap>
          <Select
            placeholder="Khoảng thời gian"
            style={{ width: 160 }}
            value={filterDays}
            onChange={(val) => setFilterDays(val)}
            options={[
              { label: '⚡ 15 ngày tới', value: '15' },
              { label: '⚡ 30 ngày tới', value: '30' },
              { label: '⚡ 90 ngày tới', value: '90' },
              { label: 'Tất cả ngày lễ', value: 'all' }
            ]}
          />
          <Select
            placeholder="Lọc theo năm"
            allowClear
            style={{ width: 130 }}
            value={filterYear}
            onChange={(val) => setFilterYear(val)}
            options={[
              { label: 'Tất cả năm', value: undefined },
              { label: 'Năm 2025', value: 2025 },
              { label: 'Năm 2026', value: 2026 },
              { label: 'Năm 2027', value: 2027 },
              { label: 'Năm 2028', value: 2028 }
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchHolidays} loading={loading}>Làm mới</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenAddModal} size="large" style={{ background: '#1d4ed8' }}>
            Thêm ngày lễ mới
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title="Tổng số ngày lễ đã cấu hình"
              value={holidays.length}
              prefix={<CalendarOutlined style={{ color: '#2563eb' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title="Đợt nghỉ Tết Âm lịch & Giỗ Tổ"
              value={lunarCount}
              valueStyle={{ color: '#d97706' }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 16 }}>
            <Statistic
              title="Đang áp dụng trong hệ thống"
              value={activeCount}
              valueStyle={{ color: '#059669' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Table
          columns={columns}
          dataSource={holidays}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
        />
      </Card>

      {/* Modal Thêm / Sửa Ngày lễ */}
      <Modal
        title={editingHoliday ? `Chỉnh sửa ngày lễ: ${editingHoliday.name}` : 'Thêm đợt nghỉ lễ mới'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Tên ngày lễ / Tết"
            rules={[{ required: true, message: 'Vui lòng nhập tên ngày lễ' }]}
          >
            <Input placeholder="Ví dụ: Tết Nguyên Đán 2026, Quốc khánh 2/9..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="calendarType" label="Loại lịch">
                <Select
                  options={[
                    { label: 'Lễ Dương lịch', value: 'solar' },
                    { label: 'Tết Âm lịch / Rời năm', value: 'lunar_variable' },
                    { label: 'Sự kiện tùy chỉnh', value: 'custom' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="year" label="Năm áp dụng (Tùy chọn)">
                <InputNumber placeholder="Ví dụ: 2026" style={{ width: '100%' }} min={2020} max={2050} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="dateRange"
            label="Khoảng thời gian thực tế (Dương lịch)"
            rules={[{ required: true, message: 'Vui lòng chọn khoảng thời gian ngày lễ' }]}
          >
            <RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="surchargePercent"
                label="Tỷ lệ phụ thu (%)"
                rules={[{ required: true, message: 'Nhập tỷ lệ phụ thu' }]}
              >
                <InputNumber
                  min={0}
                  max={200}
                  style={{ width: '100%' }}
                  addonAfter="%"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Trạng thái">
                <Select
                  options={[
                    { label: 'Kích hoạt', value: 'active' },
                    { label: 'Tạm ẩn', value: 'inactive' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="isRecurring" valuePropName="checked" label="Tự động lặp lại hàng năm (Dành cho Lễ Dương lịch)">
            <Switch />
          </Form.Item>

          <Form.Item name="description" label="Ghi chú thêm">
            <Input.TextArea rows={2} placeholder="Mô tả hoặc ghi chú thêm cho dịp lễ" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HolidayManagement;
