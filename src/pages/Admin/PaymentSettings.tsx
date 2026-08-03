import { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Select, Button, message, QRCode, Alert, Spin, InputNumber } from 'antd';
import { BankOutlined, SaveOutlined, TeamOutlined } from '@ant-design/icons';
import api from '../../services/api';
import {
  getPaymentSettings,
  updatePaymentSettings,
  type PaymentSettings as PaymentSettingsData,
} from '../../services/settingsService';
import { VIETQR_BANKS, buildVietQrPayload, findBankByBin, toTransferText } from '../../utils/vietqr';

interface FormValues {
  bankBin: string;
  accountNumber: string;
  accountName: string;
  transferPrefix: string;
}

interface ChildrenPolicy {
  freeMaxAge: number;
  childMaxAge: number;
  surchargePerNight: number;
}

const PaymentSettings = () => {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [childrenPolicy, setChildrenPolicy] = useState<ChildrenPolicy>({
    freeMaxAge: 5,
    childMaxAge: 11,
    surchargePerNight: 200000,
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  const bankBin = Form.useWatch('bankBin', form);
  const accountNumber = Form.useWatch('accountNumber', form);
  const accountName = Form.useWatch('accountName', form);
  const transferPrefix = Form.useWatch('transferPrefix', form);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getPaymentSettings();
        form.setFieldsValue({
          bankBin: res.data.bankBin,
          accountNumber: res.data.accountNumber,
          accountName: res.data.accountName,
          transferPrefix: res.data.transferPrefix || 'HB',
        });
      } catch {
        message.error('Không thể tải cài đặt thanh toán');
      } finally {
        setLoading(false);
      }

      try {
        const policyRes = (await api.get('/settings/children-policy')) as { data: ChildrenPolicy };
        setChildrenPolicy(policyRes.data);
      } catch {
        // dùng mặc định nếu chưa cấu hình
      }
    };
    load();
  }, [form]);

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      await api.put('/settings/children-policy', childrenPolicy);
      message.success('Đã lưu chính sách phụ thu trẻ em');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể lưu chính sách');
    } finally {
      setSavingPolicy(false);
    }
  };

  const previewQr = useMemo(() => {
    if (!bankBin || !accountNumber) return '';
    return buildVietQrPayload({
      bankBin,
      accountNumber,
      amount: 100000,
      addInfo: `${transferPrefix || 'HB'}123`,
    });
  }, [bankBin, accountNumber, transferPrefix]);

  const selectedBank = bankBin ? findBankByBin(bankBin) : undefined;

  const handleSave = async (values: FormValues) => {
    const bank = findBankByBin(values.bankBin);
    setSaving(true);
    try {
      const payload: PaymentSettingsData = {
        bankBin: values.bankBin,
        bankCode: bank?.code || '',
        bankName: bank?.name || '',
        accountNumber: values.accountNumber.trim(),
        accountName: toTransferText(values.accountName),
        transferPrefix: (values.transferPrefix || 'HB').toUpperCase(),
      };
      await updatePaymentSettings(payload);
      message.success('Đã lưu tài khoản nhận tiền');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      <h1 style={{ marginBottom: 4 }}>Cài đặt thanh toán</h1>
      <p style={{ color: '#8a93a5', marginBottom: 24 }}>
        Tài khoản nhận tiền dùng để tạo mã VietQR trên trang thanh toán của khách.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
        <Card title={<><BankOutlined /> Tài khoản nhận tiền</>}>
          <Form form={form} layout="vertical" onFinish={handleSave} requiredMark="optional">
            <Form.Item
              name="bankBin"
              label="Ngân hàng"
              rules={[{ required: true, message: 'Vui lòng chọn ngân hàng' }]}
            >
              <Select
                showSearch
                placeholder="Chọn ngân hàng"
                optionFilterProp="label"
                options={VIETQR_BANKS.map((bank) => ({
                  value: bank.bin,
                  label: `${bank.shortName} — ${bank.name}`,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="accountNumber"
              label="Số tài khoản"
              rules={[
                { required: true, message: 'Vui lòng nhập số tài khoản' },
                { pattern: /^[A-Za-z0-9]{4,19}$/, message: 'Số tài khoản 4-19 ký tự chữ/số, không khoảng trắng' },
              ]}
            >
              <Input placeholder="VD: 0399999999" maxLength={19} />
            </Form.Item>

            <Form.Item
              name="accountName"
              label="Tên chủ tài khoản"
              rules={[{ required: true, min: 3, message: 'Tên chủ tài khoản tối thiểu 3 ký tự' }]}
              extra="Tên sẽ tự chuyển thành chữ in hoa không dấu theo chuẩn ngân hàng"
            >
              <Input placeholder="VD: NGUYEN VAN A" maxLength={50} />
            </Form.Item>

            <Form.Item
              name="transferPrefix"
              label="Tiền tố nội dung chuyển khoản"
              extra='Nội dung chuyển khoản của khách sẽ có dạng "<tiền tố><mã đặt phòng>", ví dụ HB123'
            >
              <Input placeholder="HB" maxLength={10} style={{ width: 160 }} />
            </Form.Item>

            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              Lưu cài đặt
            </Button>
          </Form>
        </Card>

        <Card title="Xem trước mã VietQR">
          {previewQr ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <QRCode value={previewQr} size={220} errorLevel="M" />
              <div style={{ textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
                <div>
                  <strong>{selectedBank?.shortName || '—'}</strong> · {accountNumber || '—'}
                </div>
                <div>{accountName ? toTransferText(accountName) : '—'}</div>
                <div style={{ marginTop: 4 }}>
                  Mẫu: 100.000₫ · Nội dung {(transferPrefix || 'HB').toUpperCase()}123
                </div>
              </div>
              <Alert
                style={{ width: '100%' }}
                type="info"
                showIcon
                message="Quét thử bằng app ngân hàng để kiểm tra đúng tài khoản trước khi lưu."
              />
            </div>
          ) : (
            <Alert type="warning" showIcon message="Nhập ngân hàng và số tài khoản để xem trước mã QR" />
          )}
        </Card>
      </div>

      <Card title={<><TeamOutlined /> Phụ thu trẻ em</>} style={{ marginTop: 20, maxWidth: 660 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ marginBottom: 6 }}>Miễn phí đến (tuổi)</div>
              <InputNumber
                min={0}
                max={17}
                value={childrenPolicy.freeMaxAge}
                onChange={(value) =>
                  setChildrenPolicy((prev) => ({ ...prev, freeMaxAge: Number(value) || 0 }))
                }
              />
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>Phụ thu đến (tuổi)</div>
              <InputNumber
                min={1}
                max={17}
                value={childrenPolicy.childMaxAge}
                onChange={(value) =>
                  setChildrenPolicy((prev) => ({ ...prev, childMaxAge: Number(value) || 0 }))
                }
              />
            </div>
            <div>
              <div style={{ marginBottom: 6 }}>Phụ thu mỗi đêm (₫)</div>
              <InputNumber
                min={0}
                step={50000}
                style={{ width: 180 }}
                value={childrenPolicy.surchargePerNight}
                onChange={(value) =>
                  setChildrenPolicy((prev) => ({ ...prev, surchargePerNight: Number(value) || 0 }))
                }
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(value) => Number((value || '0').replace(/\./g, ''))}
              />
            </div>
          </div>
          <Alert
            type="info"
            showIcon
            message={`Hiện tại: 0–${childrenPolicy.freeMaxAge} tuổi miễn phí · ${childrenPolicy.freeMaxAge + 1}–${childrenPolicy.childMaxAge} tuổi phụ thu ${new Intl.NumberFormat('vi-VN').format(childrenPolicy.surchargePerNight)}₫/đêm · từ ${childrenPolicy.childMaxAge + 1} tuổi tính như người lớn`}
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingPolicy}
            style={{ alignSelf: 'flex-start' }}
            onClick={handleSavePolicy}
          >
            Lưu chính sách
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default PaymentSettings;
