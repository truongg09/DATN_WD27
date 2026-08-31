import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Space,
  Card,
  Tag,
  Tooltip,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import api from '../../../services/api';
import { unwrapList } from '../../../utils/unwrapList';
import { formatPrice } from './helpers';

const { TextArea } = Input;

interface DamageReport {
  id: number;
  bookingId: number | null;
  roomItemId: number | null;
  description: string;
  compensationFee: string | number;
  reportDate: string;
  itemName: string | null;
  roomId: number | null;
  roomNumber: string | null;
  bookingCustomer: string | null;
}

interface RoomItemOption {
  id: number;
  itemName: string;
  roomNumber: string | null;
}

interface BookingOption {
  id: number;
  customer_name?: string;
  room_number?: string;
}

interface DamageFormValues {
  roomItemId: number;
  bookingId?: number;
  description: string;
  compensationFee: number;
  reportDate?: dayjs.Dayjs;
}

function DamageReportsTab() {
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [roomItems, setRoomItems] = useState<RoomItemOption[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingReport, setEditingReport] = useState<DamageReport | null>(null);
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm<DamageFormValues>();

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/damage-reports');
      setReports(unwrapList<DamageReport>(response));
    } catch (error) {
      console.error('Error fetching damage reports:', error);
      message.error('Lỗi khi tải danh sách báo hỏng');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const [itemRes, bookingRes] = await Promise.all([
        api.get('/room-items'),
        api.get('/bookings'),
      ]);
      setRoomItems(unwrapList<RoomItemOption>(itemRes));
      setBookings(unwrapList<BookingOption>(bookingRes));
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  useEffect(() => {
    void fetchReports();
    void fetchOptions();
  }, []);

  const handleAdd = () => {
    setEditingReport(null);
    form.resetFields();
    form.setFieldsValue({ reportDate: dayjs() });
    setModalVisible(true);
  };

  const handleEdit = (report: DamageReport) => {
    setEditingReport(report);
    form.setFieldsValue({
      roomItemId: report.roomItemId ?? undefined,
      bookingId: report.bookingId ?? undefined,
      description: report.description,
      compensationFee:
        typeof report.compensationFee === 'number'
          ? report.compensationFee
          : parseFloat(report.compensationFee) || 0,
      reportDate: report.reportDate ? dayjs(report.reportDate) : undefined,
    });
    setModalVisible(true);
  };

  const handleViewDetail = (report: DamageReport) => {
    setSelectedReport(report);
    setDetailVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/damage-reports/${id}`);
      message.success('Xóa báo hỏng thành công');
      void fetchReports();
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi xóa báo hỏng');
    }
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        roomItemId: values.roomItemId,
        bookingId: values.bookingId ?? null,
        description: values.description,
        compensationFee: values.compensationFee,
        reportDate: values.reportDate ? values.reportDate.format('YYYY-MM-DD HH:mm:ss') : undefined,
      };
      setSubmitting(true);
      if (editingReport) {
        await api.put(`/damage-reports/${editingReport.id}`, payload);
        message.success('Cập nhật báo hỏng thành công');
      } else {
        await api.post('/damage-reports', payload);
        message.success('Tạo báo hỏng thành công');
      }
      setModalVisible(false);
      void fetchReports();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        message.error(error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const keyword = searchText.trim().toLowerCase();
  const filtered = keyword
    ? reports.filter(
        (r) =>
          (r.itemName || '').toLowerCase().includes(keyword) ||
          (r.description || '').toLowerCase().includes(keyword) ||
          (r.roomNumber || '').toLowerCase().includes(keyword) ||
          (r.bookingCustomer || '').toLowerCase().includes(keyword)
      )
    : reports;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70, sorter: (a: DamageReport, b: DamageReport) => a.id - b.id },
    {
      title: 'Vật dụng',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (text: string | null, record: DamageReport) => (
        <span>
          <strong>{text || '—'}</strong>
          {record.roomNumber ? <Tag style={{ marginLeft: 8 }}>Phòng {record.roomNumber}</Tag> : null}
        </span>
      ),
    },
    {
      title: 'Đơn đặt phòng',
      key: 'booking',
      render: (_: unknown, record: DamageReport) =>
        record.bookingId ? (
          <span>
            #{record.bookingId}
            {record.bookingCustomer ? ` · ${record.bookingCustomer}` : ''}
          </span>
        ) : (
          <span style={{ color: '#aaa' }}>—</span>
        ),
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Phí bồi thường',
      dataIndex: 'compensationFee',
      key: 'compensationFee',
      width: 160,
      sorter: (a: DamageReport, b: DamageReport) =>
        (parseFloat(a.compensationFee as string) || 0) - (parseFloat(b.compensationFee as string) || 0),
      render: (fee: string | number) => <Tag color="red">{formatPrice(fee)}</Tag>,
    },
    {
      title: 'Ngày báo',
      dataIndex: 'reportDate',
      key: 'reportDate',
      width: 160,
      sorter: (a: DamageReport, b: DamageReport) =>
        dayjs(a.reportDate).valueOf() - dayjs(b.reportDate).valueOf(),
      render: (date: string) => (date ? dayjs(date).format('DD/MM/YYYY HH:mm') : '—'),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 200,
      // Cùng quy ước với các bảng khác: một nút chính tô đậm, thao tác phụ dùng
      // nút viền, thao tác xóa dùng tone đỏ.
      render: (_: unknown, record: DamageReport) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết báo hỏng">
            <Button
              type="primary"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Sửa báo hỏng">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Tooltip title="Xóa báo hỏng">
              <Button danger icon={<DeleteOutlined />} size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={<span style={{ fontWeight: 'bold' }}>Báo hỏng / Bồi thường</span>}
      extra={
        <Space>
          <Input
            allowClear
            placeholder="Tìm theo vật dụng / mô tả / khách..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 260 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchReports}>
            Làm mới
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            Tạo báo hỏng
          </Button>
        </Space>
      }
    >
      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} báo hỏng` }}
      />

      <Modal
        title={editingReport ? 'Cập Nhật Báo Hỏng' : 'Tạo Báo Hỏng Mới'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        forceRender
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} onFinish={handleModalSubmit}>
          <Form.Item
            name="roomItemId"
            label="Vật dụng bị hỏng"
            rules={[{ required: true, message: 'Vui lòng chọn vật dụng!' }]}
          >
            <Select
              showSearch
              placeholder="Chọn vật dụng"
              optionFilterProp="label"
              options={roomItems.map((i) => ({
                value: i.id,
                label: `${i.itemName}${i.roomNumber ? ` (Phòng ${i.roomNumber})` : ''}`,
              }))}
            />
          </Form.Item>

          <Form.Item name="bookingId" label="Đơn đặt phòng liên quan (không bắt buộc)">
            <Select
              allowClear
              showSearch
              placeholder="Chọn đơn đặt phòng"
              optionFilterProp="label"
              options={bookings.map((b) => ({
                value: b.id,
                label: `#${b.id}${b.customer_name ? ` · ${b.customer_name}` : ''}${
                  b.room_number ? ` · Phòng ${b.room_number}` : ''
                }`,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả hư hỏng"
            rules={[
              { required: true, message: 'Vui lòng nhập mô tả!' },
              { whitespace: true, message: 'Mô tả không được để trống!' },
            ]}
          >
            <TextArea rows={3} placeholder="Mô tả tình trạng hư hỏng..." />
          </Form.Item>

          <Form.Item
            name="compensationFee"
            label="Phí bồi thường (VNĐ)"
            rules={[{ required: true, message: 'Vui lòng nhập phí bồi thường!' }]}
          >
            <InputNumber<number>
              min={0}
              step={1000}
              style={{ width: '100%' }}
              placeholder="Nhập phí bồi thường"
              formatter={(value) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => (value ? Number(value.replace(/,/g, '')) : 0)}
            />
          </Form.Item>

          <Form.Item name="reportDate" label="Ngày báo hỏng">
            <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" block loading={submitting}>
                {editingReport ? 'Cập nhật' : 'Tạo mới'}
              </Button>
              <Button onClick={() => setModalVisible(false)} block>
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Chi tiết báo hỏng"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedReport && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="ID">{selectedReport.id}</Descriptions.Item>
            <Descriptions.Item label="Vật dụng">{selectedReport.itemName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Phòng">{selectedReport.roomNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Đơn đặt phòng">{selectedReport.bookingId ? `#${selectedReport.bookingId}` : '—'}</Descriptions.Item>
            <Descriptions.Item label="Khách hàng">{selectedReport.bookingCustomer || '—'}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">{selectedReport.description}</Descriptions.Item>
            <Descriptions.Item label="Phí bồi thường">{formatPrice(selectedReport.compensationFee)}</Descriptions.Item>
            <Descriptions.Item label="Ngày báo">{selectedReport.reportDate ? dayjs(selectedReport.reportDate).format('DD/MM/YYYY HH:mm') : '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </Card>
  );
}

export default DamageReportsTab;