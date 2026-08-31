import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, DatePicker, message, Space, Card, Tag, Popconfirm, Select, Row, Col, Statistic, Descriptions, Tooltip, Radio, Popover } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, CalendarOutlined, GiftOutlined, DollarOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  getVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  getEligibleCustomers,
  type AdminVoucher,
  type EligibleCustomer,
} from '../../services/voucherService';
import api from '../../services/api';

const formatPercentage = (value: string | number) =>
  `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;

type RoomTypeOption = { id: number; typeName: string };

type VoucherFormValues = {
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount?: number;
  minBookingAmount?: number;
  quantity: number;
  dateRange: [Dayjs, Dayjs];
  status: string;
  roomTypeIds?: number[];
  targetType: 'all' | 'specific';
  customerIds?: number[];
};

function VoucherManagement() {
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [eligibleCustomers, setEligibleCustomers] = useState<EligibleCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<AdminVoucher | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<AdminVoucher | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm<VoucherFormValues>();
  const selectedDiscountType = Form.useWatch('discountType', form);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);

  const parseRoomTypeIds = (value?: string | null) =>
    value ? value.split(',').map(Number).filter(Boolean) : [];

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await getVouchers();
      setVouchers(response.data || response);
    } catch (error: unknown) {
      console.error('Error fetching vouchers:', error);
      message.error('Lỗi khi tải danh sách voucher');
    } finally {
      setLoading(false);
    }
  };

  const fetchEligibleCustomers = async () => {
    try {
      const response = await getEligibleCustomers();
      const list = Array.isArray(response) ? response : (response?.data || []);
      setEligibleCustomers(list);
    } catch (error: unknown) {
      console.error('Error fetching eligible customers:', error);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const response = await api.get('/rooms/types');
      const list = (response as unknown as { data?: RoomTypeOption[] }).data || [];
      setRoomTypes(list.map((item) => ({ id: item.id, typeName: item.typeName })));
    } catch (error) {
      console.error('Error fetching room types:', error);
    }
  };

  useEffect(() => {
    void fetchVouchers();
    void fetchRoomTypes();
    void fetchEligibleCustomers();
  }, []);

  const openCreateModal = () => {
    setEditingVoucher(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'active',
      discountType: 'percentage',
      targetType: 'all',
      customerIds: [],
    });
    void fetchEligibleCustomers();
    setModalVisible(true);
  };

  const openEditModal = (voucher: AdminVoucher) => {
    setEditingVoucher(voucher);
    const targetType = voucher.targetType === 'specific' ? 'specific' : 'all';
    form.setFieldsValue({
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      maxDiscount: voucher.maxDiscount || undefined,
      minBookingAmount: voucher.minBookingAmount || undefined,
      quantity: voucher.quantity,
      dateRange: [dayjs(voucher.startDate), dayjs(voucher.endDate)],
      status: voucher.status,
      roomTypeIds: parseRoomTypeIds(voucher.roomTypeIds),
      targetType: voucher.targetType === 'no_show' ? 'specific' : targetType,
      customerIds: voucher.customerIds || [],
    });
    void fetchEligibleCustomers();
    setModalVisible(true);
  };

  const handleViewDetail = (voucher: AdminVoucher) => {
    setSelectedVoucher(voucher);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteVoucher(id);
      message.success('Xóa voucher thành công');
      fetchVouchers();
    } catch (error: unknown) {
      console.error('Error deleting voucher:', error);
      message.error('Lỗi khi xóa voucher');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);

      const payload = {
        code: values.code.trim(),
        discountType: values.discountType,
        discountValue: values.discountValue,
        maxDiscount: values.maxDiscount || null,
        minBookingAmount: values.minBookingAmount || null,
        quantity: values.targetType === 'specific' ? (values.customerIds?.length || 1) : values.quantity,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        status: values.status,
        roomTypeIds: values.roomTypeIds || [],
        targetType: values.targetType || 'all',
        customerIds: values.targetType === 'specific' ? (values.customerIds || []) : [],
      };

      if (editingVoucher) {
        await updateVoucher(editingVoucher.id, payload);
        message.success('Cập nhật voucher thành công');
      } else {
        await createVoucher(payload);
        message.success('Tạo voucher thành công');
      }

      setModalVisible(false);
      fetchVouchers();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Lỗi khi lưu voucher');
    } finally {
      setSubmitLoading(false);
    }
  };

  const columns = [
    {
      title: 'Mã voucher',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: 'Loại giảm',
      dataIndex: 'discountType',
      key: 'discountType',
      render: (value: string) => (value === 'percentage' ? 'Phần trăm' : 'Cố định'),
    },
    {
      title: 'Giá trị giảm',
      dataIndex: 'discountValue',
      key: 'discountValue',
      render: (_: object, record: AdminVoucher) => 
        record.discountType === 'percentage' ? formatPercentage(record.discountValue) : `${record.discountValue}đ`,
    },
    {
      title: 'Số lượng / Lượt dùng',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (_: object, record: AdminVoucher) => {
        if (record.targetType === 'specific' || record.targetType === 'no_show') {
          const total = record.customerCount ?? record.customerIds?.length ?? 1;
          const unused = record.unusedCount ?? record.quantity ?? total;
          return <Tag color={unused > 0 ? 'blue' : 'default'}>{`${unused}/${total} lượt còn lại`}</Tag>;
        }
        return <Tag color={Number(record.quantity) > 0 ? 'blue' : 'default'}>{`${record.quantity} lượt`}</Tag>;
      },
    },
    {
      title: 'Đối tượng',
      key: 'target',
      render: (_: object, record: AdminVoucher) => {
        if (record.targetType === 'no_show') {
          const customer = record.assignedCustomers?.[0];
          const tooltipContent = customer
            ? `${customer.fullName} (${customer.email}) - Đơn #${customer.bookingId || 'No-show'}`
            : 'Voucher đền bù No-show';
          return (
            <Tooltip title={tooltipContent}>
              <Tag color="purple">Cá nhân (No-show)</Tag>
            </Tooltip>
          );
        }
        if (record.targetType === 'specific') {
          const count = record.customerCount || record.customerIds?.length || 0;
          const popoverContent = (
            <div style={{ maxWidth: 280, maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Danh sách khách hàng ({count}):</div>
              {record.assignedCustomers?.map((c) => (
                <div key={c.userId} style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ fontWeight: 500 }}>{c.fullName}</div>
                  <div style={{ color: '#888' }}>{c.email} {c.phone ? `· ${c.phone}` : ''}</div>
                  {c.isUsed ? <Tag color="default" style={{ fontSize: 10, marginTop: 2 }}>Đã dùng</Tag> : <Tag color="green" style={{ fontSize: 10, marginTop: 2 }}>Chưa dùng</Tag>}
                </div>
              ))}
            </div>
          );
          return (
            <Popover content={popoverContent} title={null} trigger="hover">
              <Tag color="cyan" style={{ cursor: 'pointer' }}>
                {count} khách hàng
              </Tag>
            </Popover>
          );
        }
        return <Tag color="blue">Tất cả khách hàng</Tag>;
      },
    },
    {
      title: 'Thời gian hiệu lực',
      key: 'dateRange',
      render: (_: object, record: AdminVoucher) => (
        <div>
          <div style={{ fontSize: 12, color: '#666' }}>Bắt đầu: {dayjs(record.startDate).format('DD/MM/YYYY')}</div>
          <div style={{ fontSize: 12, color: '#666' }}>Kết thúc: {dayjs(record.endDate).format('DD/MM/YYYY')}</div>
        </div>
      ),
    },
    {
      title: 'Hạng phòng áp dụng',
      key: 'roomTypes',
      render: (_: object, record: AdminVoucher) =>
        record.roomTypeNames ? (
          <span>
            {record.roomTypeNames.split(', ').map(name => (
              <Tag key={name} color="blue" style={{ marginBottom: 4 }}>{name}</Tag>
            ))}
          </span>
        ) : (
          <Tag>Mọi hạng phòng</Tag>
        ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: object, record: AdminVoucher) => {
        const today = dayjs();
        const expired = dayjs(record.endDate).isBefore(today, 'day');
        const status = record.status === 'active' && !expired ? 'Hoạt động' : expired ? 'Hết hạn' : record.status === 'inactive' ? 'Tắt' : 'Hoạt động';
        const color = expired ? 'red' : record.status === 'inactive' ? 'orange' : 'green';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      // Cùng quy ước với các bảng khác: một nút chính tô đậm, thao tác phụ dùng
      // nút viền, thao tác xóa dùng tone đỏ.
      render: (_: object, record: AdminVoucher) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết voucher">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Sửa voucher">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
          </Tooltip>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Tooltip title="Xóa voucher">
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalVouchers = vouchers.length;
  // Dùng chung một mốc so sánh để voucher kết thúc đúng hôm nay vẫn được tính là
  // đang hoạt động, khớp với cột Trạng thái trong bảng bên dưới.
  const isExpired = (endDate: string) => dayjs(endDate).isBefore(dayjs(), 'day');
  const activeVouchers = vouchers.filter(v => v.status === 'active' && !isExpired(v.endDate)).length;
  const expiredVouchers = vouchers.filter(v => isExpired(v.endDate)).length;

  // Khung nội dung của AdminLayout đã có sẵn padding 24 và nền riêng. Đặt thêm
  // padding cùng minHeight 100vh ở đây làm trang luôn cao hơn khung chứa, sinh
  // ra một thanh cuộn dọc thừa.
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8, color: '#2b2420' }}>Quản lý Voucher</h1>
        <p style={{ color: '#8d8478', margin: 0 }}>Tạo và quản lý các mã giảm giá cho khách hàng</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 12 }}>
            <Statistic
              title="Tổng voucher"
              value={totalVouchers}
              prefix={<GiftOutlined style={{ color: '#a78362' }} />}
              styles={{ content: { color: '#2b2420' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 12 }}>
            <Statistic
              title="Đang hoạt động"
              value={activeVouchers}
              prefix={<CalendarOutlined style={{ color: '#3f8f5f' }} />}
              styles={{ content: { color: '#3f8f5f' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 12 }}>
            <Statistic
              title="Đã hết hạn"
              value={expiredVouchers}
              prefix={<DollarOutlined style={{ color: '#bb4a3c' }} />}
              styles={{ content: { color: '#bb4a3c' } }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ background: '#fff', border: '1px solid #ece6db', borderRadius: 12 }}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchVouchers}>
              Làm mới
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ background: '#a78362', borderColor: '#a78362' }}>
              Thêm voucher
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={vouchers}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingVoucher ? 'Cập nhật voucher' : 'Thêm voucher'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Mã voucher"
                rules={[{ required: true, message: 'Vui lòng nhập mã voucher' }]}
              >
                <Input placeholder="VD: SUMMER2026" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Trạng thái"
                rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
              >
                <Select placeholder="Chọn trạng thái">
                  <Select.Option value="active">Hoạt động</Select.Option>
                  <Select.Option value="inactive">Tắt</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="discountType"
                label="Loại giảm"
                rules={[{ required: true, message: 'Vui lòng chọn loại giảm' }]}
              >
                <Select
                  placeholder="Chọn loại giảm"
                  onChange={() => {
                    form.setFieldsValue({ discountValue: undefined, maxDiscount: undefined });
                    form.validateFields(['discountValue']);
                  }}
                >
                  <Select.Option value="percentage">Phần trăm (%)</Select.Option>
                  <Select.Option value="fixed">Cố định (đ)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="discountValue"
                label="Giá trị giảm"
                rules={[
                  { required: true, message: 'Vui lòng nhập giá trị giảm' },
                  {
                    validator(_, value) {
                      if (value === undefined || value === null) return Promise.resolve();
                      if (Number(value) <= 0) {
                        return Promise.reject(new Error('Giá trị giảm phải lớn hơn 0'));
                      }
                      if (selectedDiscountType === 'percentage' && Number(value) > 100) {
                        return Promise.reject(new Error('Phần trăm giảm giá không được vượt quá 100%'));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <InputNumber
                  min={0.01}
                  max={selectedDiscountType === 'percentage' ? 100 : undefined}
                  addonAfter={selectedDiscountType === 'percentage' ? '%' : 'đ'}
                  style={{ width: '100%' }}
                  placeholder={selectedDiscountType === 'percentage' ? 'Từ 0 đến 100' : 'Nhập số tiền'}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.discountType !== curr.discountType}
              >
                {({ getFieldValue }) => {
                  const isPercentage = getFieldValue('discountType') === 'percentage';
                  return (
                    <Form.Item
                      name="maxDiscount"
                      label="Giảm tối đa (đ)"
                      // Voucher phần trăm bắt buộc có trần, nếu không đơn càng lớn
                      // khách sạn càng mất nhiều tiền.
                      rules={
                        isPercentage
                          ? [{ required: true, message: 'Voucher phần trăm phải có mức giảm tối đa' }]
                          : []
                      }
                    >
                      <InputNumber
                        min={isPercentage ? 1 : 0}
                        style={{ width: '100%' }}
                        placeholder={isPercentage ? 'Bắt buộc với voucher phần trăm' : '0 = không giới hạn'}
                      />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="minBookingAmount"
                label="Số tiền tối thiểu (đ)"
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0 = không giới hạn" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="roomTypeIds"
            label="Áp dụng cho hạng phòng"
            extra="Để trống nghĩa là voucher dùng được cho mọi hạng phòng"
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Tất cả hạng phòng"
              optionFilterProp="label"
              options={roomTypes.map(item => ({ value: item.id, label: item.typeName }))}
            />
          </Form.Item>

          <Form.Item
            name="targetType"
            label="Đối tượng áp dụng"
            rules={[{ required: true, message: 'Vui lòng chọn đối tượng áp dụng' }]}
          >
            <Radio.Group disabled={editingVoucher?.targetType === 'no_show'}>
              <Radio value="all">Tất cả khách hàng</Radio>
              <Radio value="specific">Khách hàng cụ thể</Radio>
            </Radio.Group>
          </Form.Item>

          {editingVoucher?.targetType === 'no_show' && (
            <div style={{ marginBottom: 16 }}>
              <Tag color="purple">
                Voucher bồi thường No-show tự động: không thể thay đổi đối tượng áp dụng.
              </Tag>
            </div>
          )}

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.targetType !== curr.targetType}
          >
            {({ getFieldValue }) => {
              const isSpecific = getFieldValue('targetType') === 'specific';
              if (!isSpecific) return null;

              const customerOptions = eligibleCustomers.map((cust) => ({
                value: cust.userId,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>{cust.fullName}</span>
                    <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>
                      {cust.email} {cust.phone ? `· ${cust.phone}` : ''}
                    </span>
                  </div>
                ),
                searchText: `${cust.fullName || ''} ${cust.email || ''} ${cust.phone || ''}`.toLowerCase(),
              }));

              return (
                <Form.Item
                  name="customerIds"
                  label="Khách hàng áp dụng"
                  rules={[
                    {
                      required: true,
                      message: 'Vui lòng chọn ít nhất một khách hàng',
                    },
                  ]}
                  extra="Tìm kiếm theo tên, email hoặc số điện thoại"
                >
                  <Select
                    mode="multiple"
                    showSearch
                    allowClear
                    placeholder="Tìm và chọn khách hàng..."
                    disabled={editingVoucher?.targetType === 'no_show'}
                    options={customerOptions}
                    filterOption={(input, option) => {
                      if (!input) return true;
                      const searchTarget = (option?.searchText as string) || '';
                      return searchTarget.includes(input.toLowerCase().trim());
                    }}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.targetType !== curr.targetType || prev.customerIds !== curr.customerIds}
          >
            {({ getFieldValue }) => {
              const isSpecific = getFieldValue('targetType') === 'specific';
              if (isSpecific) {
                const selectedCusts = getFieldValue('customerIds') || [];
                const count = Array.isArray(selectedCusts) ? selectedCusts.length : 0;
                return (
                  <Form.Item label="Số lượt sử dụng">
                    <Input
                      readOnly
                      disabled
                      value={`${count} lượt — mỗi khách 1 lượt`}
                      style={{ color: '#1890ff', fontWeight: 500 }}
                    />
                  </Form.Item>
                );
              }
              return (
                <Form.Item
                  name="quantity"
                  label="Số lượng"
                  rules={[{ required: true, message: 'Vui lòng nhập số lượng' }]}
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="Số lượng voucher" />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Thời gian hiệu lực"
            rules={[
              { required: true, message: 'Vui lòng chọn thời gian hiệu lực' },
              {
                validator(_, value) {
                  if (value && value[0] && value[1]) {
                    if (value[1].isBefore(value[0])) {
                      return Promise.reject(new Error('Ngày kết thúc phải sau ngày bắt đầu'));
                    }
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              placeholder={['Ngày bắt đầu', 'Ngày kết thúc']}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" block loading={submitLoading}>
                {editingVoucher ? 'Cập nhật' : 'Tạo'}
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
        title="Chi tiết voucher"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={650}
      >
        {selectedVoucher && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="ID">{selectedVoucher.id}</Descriptions.Item>
            <Descriptions.Item label="Mã voucher">{selectedVoucher.code}</Descriptions.Item>
            <Descriptions.Item label="Loại giảm">
              {selectedVoucher.discountType === 'percentage' ? 'Phần trăm (%)' : 'Cố định (đ)'}
            </Descriptions.Item>
            <Descriptions.Item label="Giá trị giảm">
              {selectedVoucher.discountType === 'percentage' ? formatPercentage(selectedVoucher.discountValue) : `${selectedVoucher.discountValue}đ`}
            </Descriptions.Item>
            <Descriptions.Item label="Giảm tối đa">
              {selectedVoucher.maxDiscount ? `${selectedVoucher.maxDiscount.toLocaleString('vi-VN')}đ` : 'Không giới hạn'}
            </Descriptions.Item>
            <Descriptions.Item label="Số tiền tối thiểu">
              {selectedVoucher.minBookingAmount ? `${selectedVoucher.minBookingAmount.toLocaleString('vi-VN')}đ` : 'Không giới hạn'}
            </Descriptions.Item>
            <Descriptions.Item label="Hạng phòng áp dụng">
              {selectedVoucher.roomTypeNames ? (
                <span>
                  {selectedVoucher.roomTypeNames.split(', ').map(name => (
                    <Tag key={name} color="blue" style={{ marginBottom: 4 }}>{name}</Tag>
                  ))}
                </span>
              ) : (
                <Tag>Mọi hạng phòng</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Đối tượng áp dụng">
              {selectedVoucher.targetType === 'no_show' ? (
                <div>
                  <Tag color="purple" style={{ marginBottom: 8 }}>Cá nhân (Bồi thường No-show)</Tag>
                  {selectedVoucher.assignedCustomers?.map((c) => (
                    <div key={c.userId} style={{ fontSize: 13, marginTop: 4 }}>
                      <strong>{c.fullName}</strong> — {c.email} {c.phone ? `— ${c.phone}` : ''} {c.bookingId ? `(Đơn #${c.bookingId})` : ''}
                      <div>
                        <Tag color={c.isUsed ? 'default' : 'green'} style={{ marginTop: 2 }}>
                          {c.isUsed ? 'Đã sử dụng' : 'Chưa sử dụng'}
                        </Tag>
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedVoucher.targetType === 'specific' ? (
                <div>
                  <Tag color="cyan" style={{ marginBottom: 8 }}>
                    Khách hàng cụ thể ({selectedVoucher.customerCount || selectedVoucher.assignedCustomers?.length || 0} khách hàng)
                  </Tag>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 12px' }}>
                    {selectedVoucher.assignedCustomers && selectedVoucher.assignedCustomers.length > 0 ? (
                      selectedVoucher.assignedCustomers.map((c) => (
                        <div key={c.userId} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #fafafa' }}>
                          <div><strong>{c.fullName}</strong> — {c.email} {c.phone ? `— ${c.phone}` : ''}</div>
                          <div>
                            <Tag color={c.isUsed ? 'default' : 'green'} style={{ fontSize: 10 }}>
                              {c.isUsed ? 'Đã sử dụng' : 'Chưa sử dụng'}
                            </Tag>
                          </div>
                        </div>
                      ))
                    ) : (
                      <span style={{ color: '#999' }}>Chưa có khách hàng được gán</span>
                    )}
                  </div>
                </div>
              ) : (
                <Tag color="blue">Tất cả khách hàng (Công khai)</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Số lượng / Lượt dùng">
              {selectedVoucher.targetType === 'specific' || selectedVoucher.targetType === 'no_show'
                ? `${selectedVoucher.unusedCount ?? selectedVoucher.quantity ?? 0}/${selectedVoucher.customerCount ?? 1} lượt còn lại`
                : `${selectedVoucher.quantity} lượt`}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày bắt đầu">{dayjs(selectedVoucher.startDate).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Ngày kết thúc">{dayjs(selectedVoucher.endDate).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={selectedVoucher.status === 'active' ? 'green' : 'orange'}>
                {selectedVoucher.status === 'active' ? 'Hoạt động' : 'Tắt'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default VoucherManagement;