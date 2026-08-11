import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Popconfirm,
  Space,
  Card,
  Descriptions,
  Tag,
  Tooltip
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import axios from 'axios';
import api from '../../services/api';

const { Option } = Select;

interface Employee {
  id: number;
  accountId: number;
  fullName: string;
  phone: string;
  position: string;
  salary: number;
  hireDate: string;
  email: string;
  status: string;
  created_at: string;
}

interface EmployeeFormValues {
  fullName: string;
  email: string;
  phone: string;
  position: string;
  salary: number;
  hireDate: Dayjs;
  status: string;
  password?: string;
}

function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [form] = Form.useForm();

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      message.error('Lỗi khi tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEmployees();
  }, []);

  const handleAdd = () => {
    setEditingEmployee(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    form.setFieldsValue({
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      salary: employee.salary,
      hireDate: dayjs(employee.hireDate),
      status: employee.status
    });
    setModalVisible(true);
  };

  const handleViewDetail = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/employees/${id}`);
      message.success('Xóa nhân viên thành công');
      fetchEmployees();
    } catch (error: unknown) {
      console.error('Error deleting employee:', error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi xóa nhân viên');
    }
  };

  const handleSubmit = async (values: EmployeeFormValues) => {
    try {
      // Format hireDate to ISO string
      const submitValues = {
        ...values,
        hireDate: values.hireDate ? values.hireDate.format('YYYY-MM-DD') : null
      };

      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, submitValues);
        message.success('Cập nhật nhân viên thành công');
      } else {
        await api.post('/employees', submitValues);
        message.success('Thêm nhân viên thành công');
      }
      setModalVisible(false);
      fetchEmployees();
    } catch (error: unknown) {
      console.error('Error submitting form:', error);
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      message.error(msg || 'Lỗi khi lưu thông tin');
    }
  };

  const columns = [
    {
      title: 'Họ tên',
      dataIndex: 'fullName',
      key: 'fullName',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Số điện thoại',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Chức vụ',
      dataIndex: 'position',
      key: 'position',
    },
    // {
    //   title: 'Lương',
    //   dataIndex: 'salary',
    //   key: 'salary',
    //   render: (salary: number) => salary.toLocaleString(),
    // },
    // {
    //   title: 'Ngày vào làm',
    //   dataIndex: 'hireDate',
    //   key: 'hireDate',
    //   render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
    // },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
        </Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: unknown, record: Employee) => (
        <Space size={[4, 4]} wrap>
          <Tooltip title="Xem chi tiết nhân viên">
            <Button
              type="primary"
              icon={<EyeOutlined style={{ color: 'white' }} />}
              size="small"
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa nhân viên">
            <Button 
              type="primary" 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Tooltip title="Xóa nhân viên">
              <Button 
                type="primary" 
                danger 
                icon={<DeleteOutlined />} 
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <div>
      <Card title="Quản lý nhân viên" extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchEmployees}
            loading={loading}
          >
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            Thêm nhân viên
          </Button>
        </Space>
      }>
        <Table
            columns={columns}
            dataSource={employees}
            rowKey="id"
            loading={loading}
          />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingEmployee ? 'Sửa nhân viên' : 'Thêm nhân viên'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="fullName"
            label="Họ tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nhập họ tên" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' }
            ]}
          >
            <Input placeholder="Nhập email" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
          >
            <Input placeholder="Nhập số điện thoại" />
          </Form.Item>

          <Form.Item
            name="position"
            label="Chức vụ"
            rules={[{ required: true, message: 'Vui lòng nhập chức vụ' }]}
          >
            <Input placeholder="Nhập chức vụ" />
          </Form.Item>

          <Form.Item
            name="salary"
            label="Lương"
            rules={[{ required: true, message: 'Vui lòng nhập lương' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Nhập lương"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') ?? ''}
            />
          </Form.Item>

          <Form.Item
            name="hireDate"
            label="Ngày vào làm"
            rules={[{ required: true, message: 'Vui lòng chọn ngày vào làm' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          {!editingEmployee && (
            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu' },
                { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
              ]}
            >
              <Input.Password placeholder="Nhập mật khẩu" />
            </Form.Item>
          )}

          {editingEmployee && (
            <Form.Item
              name="status"
              label="Trạng thái"
              initialValue="active"
            >
              <Select>
                <Option value="active">Hoạt động</Option>
                <Option value="inactive">Không hoạt động</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" block>
                {editingEmployee ? 'Cập nhật' : 'Thêm'}
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
        title="Chi tiết nhân viên"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedEmployee && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="ID">{selectedEmployee.id}</Descriptions.Item>
            <Descriptions.Item label="Họ tên">{selectedEmployee.fullName}</Descriptions.Item>
            <Descriptions.Item label="Email">{selectedEmployee.email}</Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{selectedEmployee.phone}</Descriptions.Item>
            <Descriptions.Item label="Chức vụ">{selectedEmployee.position}</Descriptions.Item>
            <Descriptions.Item label="Lương">{selectedEmployee.salary.toLocaleString('vi-VN')} VND</Descriptions.Item>
            <Descriptions.Item label="Ngày vào làm">{dayjs(selectedEmployee.hireDate).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <span style={{
                color: selectedEmployee.status === 'active' ? '#52c41a' : '#ff4d4f',
                fontWeight: 'bold'
              }}>
                {selectedEmployee.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">{dayjs(selectedEmployee.created_at).format('DD/MM/YYYY HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default EmployeeManagement;
