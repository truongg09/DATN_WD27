import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Select,
  Radio,
  Tag,
  Space,
  Card,
  Popconfirm,
  message,
  Typography,
  Tooltip,
  AutoComplete
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DollarCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../../services/api';
import { getRoomPrices, createRoomPrice, updateRoomPrice, deleteRoomPrice } from '../../../services/roomService';
import type { RoomType } from '../../../types/room';
import type { RoomPriceRule } from '../../../services/roomService';
import { formatPrice } from './helpers';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const HolidayPriceManagementTab: React.FC = () => {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [priceRules, setPriceRules] = useState<RoomPriceRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [selectedTypeIdForPrice, setSelectedTypeIdForPrice] = useState<number | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<'15days' | '30days' | '90days' | 'all'>('90days');
  const [priceRuleFormVisible, setPriceRuleFormVisible] = useState(false);
  const [editingPriceRule, setEditingPriceRule] = useState<RoomPriceRule | null>(null);

  const [priceForm] = Form.useForm();

  const fetchRoomTypes = async () => {
    setLoading(true);
    try {
      const response: any = await api.get('/rooms/types');
      setRoomTypes(response.data || response || []);
    } catch (error) {
      console.error('Lỗi khi tải danh sách hạng phòng:', error);
      message.error('Không thể tải danh sách hạng phòng');
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceRules = async (typeId?: number | null) => {
    setPriceLoading(true);
    try {
      const res: any = await getRoomPrices(typeId ? { roomTypeId: typeId } : undefined);
      setPriceRules(res.data || []);
    } catch {
      message.error('Không thể tải danh sách bảng giá');
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomTypes();
    fetchPriceRules(null);
  }, []);

  const filteredPriceRules = useMemo(() => {
    if (filterPeriod === 'all') return priceRules;
    const daysMap = { '15days': 15, '30days': 30, '90days': 90 };
    const numDays = daysMap[filterPeriod] || 90;
    const today = dayjs().startOf('day');
    const futureLimit = dayjs().add(numDays, 'day').endOf('day');

    return priceRules.filter((r) => {
      const start = dayjs(r.startDate);
      const end = dayjs(r.endDate);
      const diffDays = end.diff(start, 'day');

      // Khi chọn lọc theo 15, 30, 90 ngày tới, ẩn các quy tắc Cuối tuần dài hạn (> 180 ngày)
      // để tập trung hiển thị các ngày lễ / ngày tùy chọn cận kề
      if (r.priceType === 'weekend' && diffDays > 180) {
        return false;
      }

      return (start.isBefore(futureLimit) || start.isSame(futureLimit, 'day')) &&
             (end.isAfter(today) || end.isSame(today, 'day'));
    });
  }, [priceRules, filterPeriod]);

  const handleOpenAddPriceRule = () => {
    setEditingPriceRule(null);
    priceForm.resetFields();
    priceForm.setFieldsValue({
      roomTypeId: 'all',
      priceType: 'holiday',
      priceMode: 'percent',
      surchargePercent: 10,
      dateRange: [dayjs(), dayjs().add(2, 'day')],
      price: 600000,
      note: undefined
    });
    setPriceRuleFormVisible(true);
  };

  const handleOpenEditPriceRule = (rule: RoomPriceRule) => {
    setEditingPriceRule(rule);
    priceForm.setFieldsValue({
      roomTypeId: rule.roomTypeId || 'all',
      priceType: rule.priceType || 'holiday',
      priceMode: 'fixed',
      dateRange: [dayjs(rule.startDate), dayjs(rule.endDate)],
      price: rule.price,
      note: rule.note
    });
    setPriceRuleFormVisible(true);
  };

  const handleSavePriceRule = async () => {
    try {
      const values = await priceForm.validateFields();
      setPriceLoading(true);

      const startDate = values.dateRange[0].format('YYYY-MM-DD');
      const endDate = values.dateRange[1].format('YYYY-MM-DD');
      const note = values.note ? String(values.note).trim() : 'Quy tắc giá';

      if (editingPriceRule) {
        const selectedType = roomTypes.find((t) => t.id === values.roomTypeId);
        const basePrice = selectedType ? (typeof selectedType.defaultPrice === 'number' ? selectedType.defaultPrice : parseFloat(selectedType.defaultPrice as string) || 0) : Number(editingPriceRule.price);
        const price = values.priceMode === 'percent'
          ? Math.round(basePrice * (1 + (values.surchargePercent || 10) / 100))
          : Number(values.price);

        await updateRoomPrice(editingPriceRule.id, {
          roomTypeId: values.roomTypeId === 'all' ? null : values.roomTypeId,
          priceType: values.priceType,
          startDate,
          endDate,
          price,
          note
        });
        message.success('Cập nhật quy tắc giá thành công!');
      } else {
        if (values.roomTypeId === 'all') {
          await Promise.all(
            roomTypes.map((t) => {
              const basePrice = typeof t.defaultPrice === 'number' ? t.defaultPrice : parseFloat(t.defaultPrice as string) || 0;
              const price = values.priceMode === 'percent'
                ? Math.round(basePrice * (1 + (values.surchargePercent || 10) / 100))
                : Number(values.price || basePrice);

              return createRoomPrice({
                roomTypeId: t.id,
                priceType: values.priceType || 'holiday',
                startDate,
                endDate,
                price,
                note
              });
            })
          );
          message.success('Đã áp dụng quy tắc giá cho tất cả các hạng phòng!');
        } else {
          const selectedType = roomTypes.find((t) => t.id === values.roomTypeId);
          const basePrice = selectedType ? (typeof selectedType.defaultPrice === 'number' ? selectedType.defaultPrice : parseFloat(selectedType.defaultPrice as string) || 0) : 0;
          const price = values.priceMode === 'percent'
            ? Math.round(basePrice * (1 + (values.surchargePercent || 10) / 100))
            : Number(values.price);

          await createRoomPrice({
            roomTypeId: values.roomTypeId || null,
            priceType: values.priceType,
            startDate,
            endDate,
            price,
            note
          });
          message.success('Thêm quy tắc giá mới thành công!');
        }
      }

      setPriceRuleFormVisible(false);
      fetchPriceRules(selectedTypeIdForPrice);
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu bảng giá');
    } finally {
      setPriceLoading(false);
    }
  };

  const handleDeletePriceRule = async (id: number) => {
    try {
      await deleteRoomPrice(id);
      message.success('Đã xóa quy tắc giá');
      fetchPriceRules(selectedTypeIdForPrice);
    } catch {
      message.error('Không thể xóa quy tắc giá');
    }
  };

  return (
    <div style={{ padding: '4px 0' }}>
      <Card
        style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 24 }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <DollarCircleOutlined style={{ color: '#f59e0b', fontSize: 22 }} />
            <div>
              <Title level={4} style={{ margin: 0, color: '#1f2937' }}>
                Bảng giá Ngày lễ, Chủ nhật &amp; Ngày thường{' '}
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 15 }}>
                  {selectedTypeIdForPrice
                    ? `(Hạng phòng: ${roomTypes.find((t) => t.id === selectedTypeIdForPrice)?.typeName || ''})`
                    : '(Tất cả hạng phòng)'}
                </span>
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Quản lý các đợt nghỉ lễ Tết, cuối tuần và các ngày tùy chọn khác áp dụng giá riêng cho toàn bộ các hạng phòng
              </Text>
            </div>
          </div>
        }
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            <span>Khoảng thời gian:</span>
            <Select
              style={{ width: 170 }}
              value={filterPeriod}
              onChange={(val) => setFilterPeriod(val)}
              options={[
                { label: '⚡ 15 ngày gần nhất', value: '15days' },
                { label: '⚡ 30 ngày gần nhất', value: '30days' },
                { label: '⚡ 90 ngày gần nhất', value: '90days' },
                { label: 'Tất cả thời gian', value: 'all' }
              ]}
            />

            <span>Lọc theo hạng phòng:</span>
            <Select
              style={{ width: 220 }}
              value={selectedTypeIdForPrice}
              onChange={(val) => {
                setSelectedTypeIdForPrice(val);
                fetchPriceRules(val);
              }}
              allowClear
              placeholder="Tất cả hạng phòng"
            >
              {roomTypes.map((t) => (
                <Option key={t.id} value={t.id}>
                  {t.typeName} (Giá gốc: {formatPrice(t.defaultPrice)})
                </Option>
              ))}
            </Select>

            <Button icon={<ReloadOutlined />} onClick={() => fetchPriceRules(selectedTypeIdForPrice)} loading={priceLoading}>
              Làm mới
            </Button>
          </Space>

          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b', fontWeight: 500 }}
              onClick={handleOpenAddPriceRule}
            >
              Thêm quy tắc giá mới
            </Button>
          </Space>
        </div>

        <Table<RoomPriceRule>
          dataSource={filteredPriceRules}
          rowKey="id"
          loading={priceLoading || loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          columns={[
            {
              title: 'Hạng phòng',
              dataIndex: 'roomTypeName',
              key: 'roomTypeName',
              render: (name: string, record) => (
                <strong>{name || (record.roomTypeId ? `Hạng #${record.roomTypeId}` : 'Tất cả hạng')}</strong>
              ),
            },
            {
              title: 'Loại áp dụng',
              dataIndex: 'priceType',
              key: 'priceType',
              render: (type: string, record: RoomPriceRule) => {
                const isHolidayType = type === 'holiday';
                const noteLower = (record.note || '').toLowerCase();
                const isWeekendOnHoliday = (type === 'weekend' || type === 'saturday' || type === 'sunday') &&
                  (noteLower.includes('lễ') || noteLower.includes('tết') || noteLower.includes('quốc khánh') || noteLower.includes('kỷ niệm'));

                if (isHolidayType || isWeekendOnHoliday) {
                  return (
                    <div>
                      <Tag color="red" style={{ fontWeight: 600 }}>Dịp lễ / Tết (+10%)</Tag>
                      {isWeekendOnHoliday && (
                        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>(Trùng Thứ 7 / CN - Tính giá Lễ)</div>
                      )}
                    </div>
                  );
                }
                if (type === 'special') return <Tag color="gold">Ngày tùy chọn / Sự kiện</Tag>;
                if (type === 'weekend') return <Tag color="purple">Cuối tuần (Thứ 7 &amp; CN)</Tag>;
                if (type === 'saturday') return <Tag color="magenta">Thứ 7</Tag>;
                if (type === 'sunday') return <Tag color="orange">Chủ nhật</Tag>;
                if (type === 'season') return <Tag color="cyan">Mùa cao điểm</Tag>;
                return <Tag color="blue">Ngày thường</Tag>;
              },
            },
            {
              title: 'Thời gian áp dụng',
              key: 'period',
              render: (_: unknown, row: RoomPriceRule) => (
                <span>
                  {dayjs(row.startDate).format('DD/MM/YYYY')} - {dayjs(row.endDate).format('DD/MM/YYYY')}
                </span>
              ),
            },
            {
              title: 'Đơn giá / đêm',
              dataIndex: 'price',
              key: 'price',
              render: (price: number) => <strong style={{ color: '#047857', fontSize: 15 }}>{formatPrice(price)}</strong>,
            },
            {
              title: 'Ghi chú / Tên đợt áp dụng',
              dataIndex: 'note',
              key: 'note',
              render: (note?: string | null) => note || <span style={{ color: '#aaa' }}>—</span>,
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 120,
              align: 'right' as const,
              render: (_: unknown, row: RoomPriceRule) => (
                <Space size="small">
                  <Tooltip title="Chỉnh sửa">
                    <Button type="text" icon={<EditOutlined style={{ color: '#2563eb' }} />} onClick={() => handleOpenEditPriceRule(row)} />
                  </Tooltip>
                  <Popconfirm
                    title="Xác nhận xóa quy tắc giá này?"
                    onConfirm={() => handleDeletePriceRule(row.id)}
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                  >
                    <Tooltip title="Xóa">
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Tooltip>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* ── MODAL THÊM / SỬA QUY TẮC GIÁ NÀY (GHIM CHÍNH GIỮA MÀN HÌNH WITH centered={true}) ── */}
      <Modal
        title={editingPriceRule ? 'Chỉnh sửa quy tắc giá' : 'Thêm quy tắc giá ngày lễ / ngày tùy chọn mới'}
        open={priceRuleFormVisible}
        onCancel={() => setPriceRuleFormVisible(false)}
        onOk={handleSavePriceRule}
        okText="Lưu quy tắc"
        cancelText="Hủy"
        destroyOnHidden
        centered={true}
        width={620}
      >
        <Form form={priceForm} layout="vertical">
          <Form.Item
            name="note"
            label="Tên ngày lễ / Mô tả ngày tùy chọn (Gõ văn bản để xem gợi ý mẫu)"
            rules={[{ required: true, message: 'Vui lòng nhập tên ngày lễ hoặc mô tả!' }]}
          >
            <AutoComplete
              placeholder="Dịp nghỉ lễ / Ngày tùy chọn (Gõ chữ để xem gợi ý: Tết Dương Lịch, 2/9, Trung Thu, Khuyến mãi...)"
              options={[
                { value: 'Tết Dương Lịch', label: '🎆 Tết Dương Lịch (31/12 - 02/01)' },
                { value: 'Quốc khánh Việt Nam (2/9)', label: '🇻🇳 Quốc Khánh Việt Nam (01/09 - 03/09)' },
                { value: 'Tết Trung Thu (15/8 âm lịch)', label: '🌕 Tết Trung Thu (25/09)' },
                { value: 'Ngày Giải phóng Thủ đô (10/10)', label: '🇻🇳 Ngày Giải phóng Thủ đô (10/10)' },
                { value: 'Ngày Doanh nhân Việt Nam (13/10)', label: '💼 Ngày Doanh nhân Việt Nam (13/10)' },
                { value: 'Ngày Phụ nữ Việt Nam (20/10)', label: '💐 Ngày Phụ nữ Việt Nam (20/10)' },
                { value: 'Lễ hội Halloween (31/10)', label: '🎃 Lễ hội Halloween (31/10)' },
                { value: 'Ngày Nhà giáo Việt Nam (20/11)', label: '👨‍🏫 Ngày Nhà giáo Việt Nam (20/11)' },
                { label: '🎄 Lễ Giáng Sinh (24-25/12)', value: 'Lễ Giáng Sinh (24-25/12)' },
                { label: '🧧 Tết Âm Lịch (28 Tết - Mùng 6 Tết)', value: 'Dịp Tết Âm Lịch (28 Tết - Mùng 6 Tết)' },
                { label: '🌸 30/4 - 1/5 (30/04 - 02/05)', value: 'Dịp 30/4 - 1/5' },
              ]}
              filterOption={(inputValue, option) =>
                (option?.value || '').toLowerCase().includes(inputValue.toLowerCase()) ||
                (option?.label || '').toLowerCase().includes(inputValue.toLowerCase())
              }
              onSelect={(val) => {
                const currentYear = dayjs().year();
                const presets: Record<string, { type: string; start: string; end: string; percent: number }> = {
                  'Tết Dương Lịch': { type: 'holiday', start: `${currentYear}-12-31`, end: `${currentYear + 1}-01-02`, percent: 10 },
                  'Quốc khánh Việt Nam (2/9)': { type: 'holiday', start: `${currentYear}-09-01`, end: `${currentYear}-09-03`, percent: 10 },
                  'Tết Trung Thu (15/8 âm lịch)': { type: 'holiday', start: `${currentYear}-09-25`, end: `${currentYear}-09-25`, percent: 10 },
                  'Ngày Giải phóng Thủ đô (10/10)': { type: 'holiday', start: `${currentYear}-10-10`, end: `${currentYear}-10-10`, percent: 10 },
                  'Ngày Doanh nhân Việt Nam (13/10)': { type: 'holiday', start: `${currentYear}-10-13`, end: `${currentYear}-10-13`, percent: 5 },
                  'Ngày Phụ nữ Việt Nam (20/10)': { type: 'holiday', start: `${currentYear}-10-20`, end: `${currentYear}-10-20`, percent: 10 },
                  'Lễ hội Halloween (31/10)': { type: 'holiday', start: `${currentYear}-10-31`, end: `${currentYear}-10-31`, percent: 10 },
                  'Ngày Nhà giáo Việt Nam (20/11)': { type: 'holiday', start: `${currentYear}-11-20`, end: `${currentYear}-11-20`, percent: 10 },
                  'Lễ Giáng Sinh (24-25/12)': { type: 'holiday', start: `${currentYear}-12-24`, end: `${currentYear}-12-25`, percent: 10 },
                  'Dịp Tết Âm Lịch (28 Tết - Mùng 6 Tết)': { type: 'holiday', start: `${currentYear + 1}-01-28`, end: `${currentYear + 1}-02-04`, percent: 10 },
                  'Dịp 30/4 - 1/5': { type: 'holiday', start: `${currentYear}-04-30`, end: `${currentYear}-05-02`, percent: 10 },
                };
                const matched = presets[val];
                if (matched) {
                  priceForm.setFieldsValue({
                    priceType: matched.type,
                    dateRange: [dayjs(matched.start), dayjs(matched.end)],
                    surchargePercent: matched.percent,
                    priceMode: 'percent',
                    note: val
                  });
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="roomTypeId"
            label="Hạng phòng áp dụng"
            rules={[{ required: true, message: 'Vui lòng chọn hạng phòng!' }]}
          >
            <Select placeholder="Chọn hạng phòng áp dụng">
              <Option value="all">⭐ Áp dụng cho TẤT CẢ các hạng phòng</Option>
              {roomTypes.map((t) => (
                <Option key={t.id} value={t.id}>
                  {t.typeName} (Giá gốc: {formatPrice(t.defaultPrice)}/đêm)
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="priceType"
            label="Phân loại ngày / Đợt áp dụng"
            rules={[{ required: true, message: 'Vui lòng chọn loại ngày áp dụng!' }]}
          >
            <Radio.Group style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Radio value="holiday">
                <Tag color="red">Dịp lễ / Tết</Tag>
              </Radio>

              <Radio value="special">
                <Tag color="gold">Ngày tùy chọn / Sự kiện đặc biệt</Tag>
              </Radio>

              <Radio value="weekend">
                <Tag color="purple">Cuối tuần (Thứ 7 &amp; CN)</Tag>
              </Radio>

              <Radio value="season">
                <Tag color="cyan">Mùa cao điểm</Tag>
              </Radio>

              <Radio value="normal">
                <Tag color="blue">Ngày thường</Tag>
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Khoảng thời gian hiệu lực (Có thể chọn ngày bất kỳ do Admin tùy chỉnh)"
            rules={[{ required: true, message: 'Vui lòng chọn khoảng thời gian!' }]}
          >
            <RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} />
          </Form.Item>

          <Form.Item name="priceMode" label="Cách tính đơn giá áp dụng" initialValue="percent">
            <Radio.Group style={{ display: 'flex', gap: 16 }}>
              <Radio value="percent">Tính theo Phụ thu % (+10%, +15%...)</Radio>
              <Radio value="fixed">Nhập đơn giá cố định (VNĐ)</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.priceMode !== cur.priceMode}
          >
            {({ getFieldValue }) =>
              getFieldValue('priceMode') === 'percent' ? (
                <Form.Item
                  name="surchargePercent"
                  label="Tỷ lệ phụ thu (+%)"
                  initialValue={10}
                  rules={[{ required: true, message: 'Nhập tỷ lệ % phụ thu' }]}
                >
                  <InputNumber min={0} max={200} addonAfter="%" style={{ width: '100%' }} />
                </Form.Item>
              ) : (
                <Form.Item
                  name="price"
                  label="Đơn giá áp dụng (VNĐ / đêm)"
                  rules={[{ required: true, message: 'Vui lòng nhập đơn giá!' }]}
                >
                  <InputNumber
                    min={0}
                    step={50000}
                    style={{ width: '100%' }}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => (value ? value.replace(/\$\s?|(,*)/g, '') : '') as any}
                    addonAfter="VNĐ"
                  />
                </Form.Item>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HolidayPriceManagementTab;
