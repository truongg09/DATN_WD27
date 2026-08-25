import { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Select, Button, message, QRCode, Alert, Spin, InputNumber, Tabs, TimePicker } from 'antd';
import { BankOutlined, SaveOutlined, TeamOutlined, ClockCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import {
  getPaymentSettings,
  updatePaymentSettings,
  getLateCheckoutTiers,
  updateLateCheckoutTiers,
  getPolicies,
  updatePolicies,
  type PaymentSettings as PaymentSettingsData,
  type LateCheckoutTiersInfo,
  type PoliciesInfo,
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
  const [lateTiersForm] = Form.useForm();
  const [cancellationForm] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTiers, setSavingTiers] = useState(false);
  const [savingCancelPolicy, setSavingCancelPolicy] = useState(false);
  const [savingChildrenPolicy, setSavingChildrenPolicy] = useState(false);

  const [childrenPolicy, setChildrenPolicy] = useState<ChildrenPolicy>({
    freeMaxAge: 5,
    childMaxAge: 11,
    surchargePerNight: 200000,
  });

  const bankBin = Form.useWatch('bankBin', form);
  const accountNumber = Form.useWatch('accountNumber', form);
  const accountName = Form.useWatch('accountName', form);
  const transferPrefix = Form.useWatch('transferPrefix', form);

  const stdCheckInWatch = Form.useWatch('standardCheckInTime', lateTiersForm);
  const earlyT1HWatch = Form.useWatch('earlyTier1Hours', lateTiersForm);
  const earlyT1PWatch = Form.useWatch('earlyTier1Percent', lateTiersForm);
  const earlyT2HWatch = Form.useWatch('earlyTier2Hours', lateTiersForm);
  const earlyT2PWatch = Form.useWatch('earlyTier2Percent', lateTiersForm);
  const earlyT3HWatch = Form.useWatch('earlyTier3Hours', lateTiersForm);
  const earlyT3PWatch = Form.useWatch('earlyTier3Percent', lateTiersForm);

  const stdCheckOutWatch = Form.useWatch('standardCheckOutTime', lateTiersForm);
  const graceMinutesWatch = Form.useWatch('graceMinutes', lateTiersForm);
  const lateT1MaxHoursWatch = Form.useWatch('tier1MaxHours', lateTiersForm);
  const lateT1PercentWatch = Form.useWatch('tier1Percent', lateTiersForm);
  const lateT2MaxHoursWatch = Form.useWatch('tier2MaxHours', lateTiersForm);
  const lateT2PercentWatch = Form.useWatch('tier2Percent', lateTiersForm);
  const lateT3PercentWatch = Form.useWatch('tier3Percent', lateTiersForm);
  const absMaxLateHoursWatch = Form.useWatch('absoluteMaxLateHours', lateTiersForm);

  const earlyCheckInPreview = useMemo(() => {
    let stdH = 14;
    let stdM = 0;
    if (stdCheckInWatch && typeof (stdCheckInWatch as any).hour === 'function') {
      stdH = (stdCheckInWatch as dayjs.Dayjs).hour();
      stdM = (stdCheckInWatch as dayjs.Dayjs).minute();
    }
    const stdDecimal = stdH + (stdM / 60);

    const t1H = Number(earlyT1HWatch ?? 8.0);
    const t1P = Number(earlyT1PWatch ?? 100.0);
    const t2H = Number(earlyT2HWatch ?? 5.0);
    const t2P = Number(earlyT2PWatch ?? 50.0);
    const t3H = Number(earlyT3HWatch ?? 2.0);
    const t3P = Number(earlyT3PWatch ?? 30.0);

    const formatDec = (h: number) => {
      const norm = Math.max(0, h);
      const totalMins = Math.round(norm * 60);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const t1TimeStr = formatDec(stdDecimal - t1H);
    const t2TimeStr = formatDec(stdDecimal - t2H);
    const t3TimeStr = formatDec(stdDecimal - t3H);
    const stdTimeStr = formatDec(stdDecimal);

    return {
      t1TimeStr,
      t2TimeStr,
      t3TimeStr,
      stdTimeStr,
      t1H,
      t1P,
      t2H,
      t2P,
      t3H,
      t3P,
    };
  }, [stdCheckInWatch, earlyT1HWatch, earlyT1PWatch, earlyT2HWatch, earlyT2PWatch, earlyT3HWatch, earlyT3PWatch]);

  const lateCheckOutPreview = useMemo(() => {
    let stdH = 12;
    let stdM = 0;
    if (stdCheckOutWatch && typeof (stdCheckOutWatch as any).hour === 'function') {
      stdH = (stdCheckOutWatch as dayjs.Dayjs).hour();
      stdM = (stdCheckOutWatch as dayjs.Dayjs).minute();
    }
    const stdDecimal = stdH + (stdM / 60);

    const graceM = Number(graceMinutesWatch ?? 60);
    const t1MaxH = Number(lateT1MaxHoursWatch ?? 3.0);
    const t1P = Number(lateT1PercentWatch ?? 30.0);
    const t2MaxH = Number(lateT2MaxHoursWatch ?? 6.0);
    const t2P = Number(lateT2PercentWatch ?? 50.0);
    const t3P = Number(lateT3PercentWatch ?? 100.0);
    const maxLateH = Number(absMaxLateHoursWatch ?? 6.0);

    const formatDec = (h: number) => {
      const norm = Math.max(0, h);
      const totalMins = Math.round(norm * 60);
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const graceEndDecimal = stdDecimal + (graceM / 60);
    const t1EndDecimal = graceEndDecimal + t1MaxH;
    const t2EndDecimal = graceEndDecimal + t2MaxH;
    const softLimitDecimal = stdDecimal + maxLateH;

    const stdTimeStr = formatDec(stdDecimal);
    const graceEndTimeStr = formatDec(graceEndDecimal);
    const t1EndTimeStr = formatDec(t1EndDecimal);
    const t2EndTimeStr = formatDec(t2EndDecimal);
    const softLimitTimeStr = formatDec(softLimitDecimal);

    return {
      stdTimeStr,
      graceM,
      graceEndTimeStr,
      t1MaxH,
      t1P,
      t1EndTimeStr,
      t2MaxH,
      t2P,
      t2EndTimeStr,
      t3P,
      maxLateH,
      softLimitTimeStr,
    };
  }, [
    stdCheckOutWatch,
    graceMinutesWatch,
    lateT1MaxHoursWatch,
    lateT1PercentWatch,
    lateT2MaxHoursWatch,
    lateT2PercentWatch,
    lateT3PercentWatch,
    absMaxLateHoursWatch,
  ]);

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
      }

      try {
        const policyRes = (await api.get('/settings/children-policy')) as { data: ChildrenPolicy };
        setChildrenPolicy(policyRes.data);
      } catch {
        // dùng mặc định nếu chưa cấu hình
      }

      try {
        const tiersRes = await getLateCheckoutTiers();
        if (tiersRes.data) {
          lateTiersForm.setFieldsValue({
            standardCheckInTime: tiersRes.data.standardCheckInTime ? dayjs(tiersRes.data.standardCheckInTime, 'HH:mm:ss') : dayjs('14:00:00', 'HH:mm:ss'),
            standardCheckOutTime: tiersRes.data.standardCheckOutTime ? dayjs(tiersRes.data.standardCheckOutTime, 'HH:mm:ss') : dayjs('12:00:00', 'HH:mm:ss'),
            graceMinutes: tiersRes.data.graceMinutes ?? 60,
            tier1MaxHours: Number(tiersRes.data.tier1MaxHours ?? 3.0),
            tier1Percent: Number(tiersRes.data.tier1Percent ?? 30.0),
            tier2MaxHours: Number(tiersRes.data.tier2MaxHours ?? 6.0),
            tier2Percent: Number(tiersRes.data.tier2Percent ?? 50.0),
            tier3Percent: Number(tiersRes.data.tier3Percent ?? 100.0),
            housekeepingBufferMinutes: tiersRes.data.housekeepingBufferMinutes ?? 60,
            absoluteMaxLateHours: Number(tiersRes.data.absoluteMaxLateHours ?? 6.0),
            earlyTier1Hours: Number(tiersRes.data.earlyTier1Hours ?? 8.0),
            earlyTier1Percent: Number(tiersRes.data.earlyTier1Percent ?? 100.0),
            earlyTier2Hours: Number(tiersRes.data.earlyTier2Hours ?? 5.0),
            earlyTier2Percent: Number(tiersRes.data.earlyTier2Percent ?? 50.0),
            earlyTier3Hours: Number(tiersRes.data.earlyTier3Hours ?? 2.0),
            earlyTier3Percent: Number(tiersRes.data.earlyTier3Percent ?? 30.0),
          });
        }
      } catch {
        // dùng mặc định
      }

      try {
        const cancelRes = await getPolicies();
        if (cancelRes.data) {
          cancellationForm.setFieldsValue({
            nearTierMaxDays: cancelRes.data.nearTierMaxDays ?? 3,
            nearTierPercent: cancelRes.data.nearTierPercent ?? 100,
            midTierMaxDays: cancelRes.data.midTierMaxDays ?? 7,
            midTierPercent: cancelRes.data.midTierPercent ?? 50,
            farTierPercent: cancelRes.data.farTierPercent ?? 0,
          });
        }
      } catch {
        // dùng mặc định
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [form, lateTiersForm, cancellationForm]);

  const handleSavePayment = async (values: FormValues) => {
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

  const handleSaveLateTiers = async (values: Record<string, unknown>) => {
    const e1H = Number(values.earlyTier1Hours ?? 8.0);
    const e2H = Number(values.earlyTier2Hours ?? 5.0);
    const e3H = Number(values.earlyTier3Hours ?? 2.0);

    if (e3H <= 0 || e2H <= e3H || e1H <= e2H) {
      message.error('Các mốc giờ nhận phòng sớm phải giảm dần và lớn hơn 0 (Mức 1 > Mức 2 > Mức 3 > 0)');
      return;
    }

    setSavingTiers(true);
    try {
      const payload: LateCheckoutTiersInfo = {
        standardCheckInTime: values.standardCheckInTime ? (values.standardCheckInTime as dayjs.Dayjs).format('HH:mm:ss') : '14:00:00',
        standardCheckOutTime: values.standardCheckOutTime ? (values.standardCheckOutTime as dayjs.Dayjs).format('HH:mm:ss') : '12:00:00',
        graceMinutes: Number(values.graceMinutes ?? 60),
        tier1MaxHours: Number(values.tier1MaxHours ?? 3.0),
        tier1Percent: Number(values.tier1Percent ?? 30.0),
        tier2MaxHours: Number(values.tier2MaxHours ?? 6.0),
        tier2Percent: Number(values.tier2Percent ?? 50.0),
        tier3Percent: Number(values.tier3Percent ?? 100.0),
        housekeepingBufferMinutes: Number(values.housekeepingBufferMinutes ?? 60),
        absoluteMaxLateHours: Number(values.absoluteMaxLateHours ?? 6.0),
        earlyTier1Hours: e1H,
        earlyTier1Percent: Number(values.earlyTier1Percent ?? 100.0),
        earlyTier2Hours: e2H,
        earlyTier2Percent: Number(values.earlyTier2Percent ?? 50.0),
        earlyTier3Hours: e3H,
        earlyTier3Percent: Number(values.earlyTier3Percent ?? 30.0),
      };
      await updateLateCheckoutTiers(payload);
      message.success('Đã lưu cấu hình giờ chuẩn, nhận phòng sớm và phí trả phòng muộn');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể lưu cấu hình trễ giờ');
    } finally {
      setSavingTiers(false);
    }
  };

  const handleSaveCancellationPolicy = async (values: Record<string, unknown>) => {
    setSavingCancelPolicy(true);
    try {
      const currentLateTiers = lateTiersForm.getFieldsValue();
      const payload: Partial<PoliciesInfo> = {
        checkInTime: currentLateTiers.standardCheckInTime ? currentLateTiers.standardCheckInTime.format('HH:mm:ss') : '14:00:00',
        checkOutTime: currentLateTiers.standardCheckOutTime ? currentLateTiers.standardCheckOutTime.format('HH:mm:ss') : '12:00:00',
        nearTierMaxDays: Number(values.nearTierMaxDays ?? 3),
        nearTierPercent: Number(values.nearTierPercent ?? 100),
        midTierMaxDays: Number(values.midTierMaxDays ?? 7),
        midTierPercent: Number(values.midTierPercent ?? 50),
        farTierPercent: Number(values.farTierPercent ?? 0),
      };
      await updatePolicies(payload);
      message.success('Đã lưu chính sách hủy phòng');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể lưu chính sách hủy phòng');
    } finally {
      setSavingCancelPolicy(false);
    }
  };

  const handleSaveChildrenPolicy = async () => {
    setSavingChildrenPolicy(true);
    try {
      await api.put('/settings/children-policy', childrenPolicy);
      message.success('Đã lưu chính sách phụ thu trẻ em');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể lưu chính sách trẻ em');
    } finally {
      setSavingChildrenPolicy(false);
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const tabItems = [
    {
      key: '1',
      label: (
        <span>
          <BankOutlined /> Tài khoản thanh toán
        </span>
      ),
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>
          <Card title={<><BankOutlined /> Tài khoản nhận tiền (VietQR)</>}>
            <Form form={form} layout="vertical" onFinish={handleSavePayment} requiredMark="optional">
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
                Lưu tài khoản
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
      ),
    },
    {
      key: '2',
      label: (
        <span>
          <ClockCircleOutlined /> Giờ chuẩn & Phí trễ giờ
        </span>
      ),
      children: (
        <Card title={<><ClockCircleOutlined /> Khung giờ quy chuẩn & Phụ thu trả phòng muộn (Late Check-out)</>} style={{ maxWidth: 850 }}>
          <Form form={lateTiersForm} layout="vertical" onFinish={handleSaveLateTiers}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item name="standardCheckInTime" label="Giờ nhận phòng chuẩn (Check-in)">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item name="standardCheckOutTime" label="Giờ trả phòng chuẩn (Check-out)">
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item
                name="graceMinutes"
                label="Ân hạn trả phòng muộn (phút)"
                extra="Trả phòng trễ trong thời gian này sẽ được MIỄN PHÍ hoàn toàn"
              >
                <InputNumber min={0} max={180} style={{ width: '100%' }} addonAfter="phút" />
              </Form.Item>

              <Form.Item
                name="housekeepingBufferMinutes"
                label="Thời gian dọn dẹp phòng (phút)"
                extra="Thời gian tối thiểu cần để buồng phòng làm sạch phòng trước khi đón khách sau"
              >
                <InputNumber min={15} max={240} style={{ width: '100%' }} addonAfter="phút" />
              </Form.Item>
            </div>

            <Form.Item
              name="absoluteMaxLateHours"
              label="Số giờ trả phòng muộn tối đa"
              extra="Vượt quá mốc này hệ thống sẽ cảnh báo trả phòng quá muộn và kiểm tra ảnh hưởng tới lịch nhận phòng kế tiếp"
            >
              <InputNumber min={1} max={12} step={0.5} style={{ width: '100%' }} addonAfter="giờ" />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              message="Cấu hình các mốc phụ thu nhận phòng sớm (tính theo % giá 1 đêm)"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item
                name="earlyTier1Hours"
                label="Mức 1: Sớm từ (giờ)"
                rules={[{ required: true, message: 'Nhập số giờ' }]}
                extra={`Nhận phòng sớm từ ${earlyCheckInPreview.t1H} tiếng trở lên (Trước ${earlyCheckInPreview.t1TimeStr})`}
              >
                <InputNumber min={1} max={24} step={0.5} style={{ width: '100%' }} addonAfter="giờ" />
              </Form.Item>
              <Form.Item
                name="earlyTier1Percent"
                label="Mức 1: Phụ thu (%)"
                rules={[{ required: true, message: 'Nhập % phụ thu' }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>

              <Form.Item
                name="earlyTier2Hours"
                label="Mức 2: Sớm từ (giờ)"
                rules={[{ required: true, message: 'Nhập số giờ' }]}
                extra={`Nhận phòng sớm từ ${earlyCheckInPreview.t2H} đến ${earlyCheckInPreview.t1H} tiếng (${earlyCheckInPreview.t1TimeStr} - ${earlyCheckInPreview.t2TimeStr})`}
              >
                <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} addonAfter="giờ" />
              </Form.Item>
              <Form.Item
                name="earlyTier2Percent"
                label="Mức 2: Phụ thu (%)"
                rules={[{ required: true, message: 'Nhập % phụ thu' }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>

              <Form.Item
                name="earlyTier3Hours"
                label="Mức 3: Sớm từ (giờ)"
                rules={[{ required: true, message: 'Nhập số giờ' }]}
                extra={`Nhận phòng sớm từ ${earlyCheckInPreview.t3H} đến ${earlyCheckInPreview.t2H} tiếng (${earlyCheckInPreview.t2TimeStr} - ${earlyCheckInPreview.t3TimeStr})`}
              >
                <InputNumber min={0.5} max={24} step={0.5} style={{ width: '100%' }} addonAfter="giờ" />
              </Form.Item>
              <Form.Item
                name="earlyTier3Percent"
                label="Mức 3: Phụ thu (%)"
                rules={[{ required: true, message: 'Nhập % phụ thu' }]}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </div>

            {/* Dynamic Live Preview Box - Early Check-in */}
            <div style={{ marginBottom: 20, padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#334155', fontSize: 13, marginBottom: 4 }}>
                Xem trước quy tắc áp dụng theo giờ nhận phòng chuẩn hiện tại ({earlyCheckInPreview.stdTimeStr}):
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                <div>• Trước <strong>{earlyCheckInPreview.t1TimeStr}</strong> (sớm &ge; {earlyCheckInPreview.t1H}h) &rarr; Phụ thu <strong>{earlyCheckInPreview.t1P}%</strong> giá 1 đêm</div>
                <div>• <strong>{earlyCheckInPreview.t1TimeStr} – {earlyCheckInPreview.t2TimeStr}</strong> (sớm {earlyCheckInPreview.t2H}h – {earlyCheckInPreview.t1H}h) &rarr; Phụ thu <strong>{earlyCheckInPreview.t2P}%</strong> giá 1 đêm</div>
                <div>• <strong>{earlyCheckInPreview.t2TimeStr} – {earlyCheckInPreview.t3TimeStr}</strong> (sớm {earlyCheckInPreview.t3H}h – {earlyCheckInPreview.t2H}h) &rarr; Phụ thu <strong>{earlyCheckInPreview.t3P}%</strong> giá 1 đêm</div>
                <div>• <strong>{earlyCheckInPreview.t3TimeStr} – {earlyCheckInPreview.stdTimeStr}</strong> (sớm &lt; {earlyCheckInPreview.t3H}h) &rarr; <strong>Miễn phí phụ thu (0%)</strong></div>
              </div>
            </div>

            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
              message="Cấu hình các mốc phụ thu tiền phạt trả phòng muộn (tính theo % giá 1 đêm)"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item name="tier1MaxHours" label="Mức 1: Trễ tối đa (giờ)">
                <InputNumber min={0.5} max={12} step={0.5} style={{ width: '100%' }} addonAfter="giờ" />
              </Form.Item>
              <Form.Item name="tier1Percent" label="Mức 1: Phụ thu (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>

              <Form.Item name="tier2MaxHours" label="Mức 2: Trễ tối đa (giờ)">
                <InputNumber min={1} max={12} step={0.5} style={{ width: '100%' }} addonAfter="giờ" />
              </Form.Item>
              <Form.Item name="tier2Percent" label="Mức 2: Phụ thu (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>

              <Form.Item name="tier3Percent" label="Mức 3 (Vượt mức 2): Phụ thu (%)" style={{ gridColumn: 'span 2' }}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </div>

            {/* Dynamic Live Preview Box - Late Check-out */}
            <div style={{ marginBottom: 20, padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#334155', fontSize: 13, marginBottom: 4 }}>
                Xem trước quy tắc áp dụng theo giờ trả phòng chuẩn hiện tại ({lateCheckOutPreview.stdTimeStr}):
              </div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                <div>• Trễ trong <strong>{lateCheckOutPreview.graceM} phút</strong> đầu ({lateCheckOutPreview.stdTimeStr} – {lateCheckOutPreview.graceEndTimeStr}) &rarr; Miễn phí trong thời gian ân hạn</div>
                <div>• Sau ân hạn, trễ tối đa <strong>{lateCheckOutPreview.t1MaxH} giờ</strong> ({lateCheckOutPreview.graceEndTimeStr} – {lateCheckOutPreview.t1EndTimeStr}) &rarr; Phụ thu <strong>{lateCheckOutPreview.t1P}%</strong> giá đêm cuối</div>
                <div>• Sau ân hạn, trễ trên <strong>{lateCheckOutPreview.t1MaxH} giờ đến {lateCheckOutPreview.t2MaxH} giờ</strong> ({lateCheckOutPreview.t1EndTimeStr} – {lateCheckOutPreview.t2EndTimeStr}) &rarr; Phụ thu <strong>{lateCheckOutPreview.t2P}%</strong> giá đêm cuối</div>
                <div>• Sau ân hạn, trễ trên <strong>{lateCheckOutPreview.t2MaxH} giờ</strong> (sau {lateCheckOutPreview.t2EndTimeStr}) &rarr; Phụ thu <strong>{lateCheckOutPreview.t3P}%</strong> giá đêm cuối</div>
                <div>• Trễ quá <strong>{lateCheckOutPreview.maxLateH} giờ</strong> tính từ giờ trả phòng chuẩn (sau {lateCheckOutPreview.softLimitTimeStr}) &rarr; Cảnh báo vượt mốc trả phòng muộn tối đa</div>
              </div>
            </div>

            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingTiers}>
              Lưu cấu hình phí trễ giờ
            </Button>
          </Form>
        </Card>
      ),
    },
    {
      key: '3',
      label: (
        <span>
          <SafetyOutlined /> Chính sách hủy phòng
        </span>
      ),
      children: (
        <Card title={<><SafetyOutlined /> Quy định hủy phòng & Tỷ lệ phạt / hoàn tiền</>} style={{ maxWidth: 750 }}>
          <Form form={cancellationForm} layout="vertical" onFinish={handleSaveCancellationPolicy}>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 20 }}
              message="Chính sách phạt khi khách tự chủ động hủy đơn trước ngày Check-in"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item
                name="nearTierMaxDays"
                label="Mốc gần ngày check-in (dưới N ngày)"
                extra="Ví dụ: Hủy trong vòng dưới 3 ngày trước khi check-in"
              >
                <InputNumber min={0} max={30} style={{ width: '100%' }} addonAfter="ngày" />
              </Form.Item>
              <Form.Item
                name="nearTierPercent"
                label="Phí phạt hủy mốc gần (%)"
                extra="100% nghĩa là giữ lại toàn bộ tiền (hoàn 0%)"
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>

              <Form.Item
                name="midTierMaxDays"
                label="Mốc trung bình (từ mốc gần đến N ngày)"
                extra="Ví dụ: Hủy từ 3 đến 7 ngày trước check-in"
              >
                <InputNumber min={1} max={60} style={{ width: '100%' }} addonAfter="ngày" />
              </Form.Item>
              <Form.Item
                name="midTierPercent"
                label="Phí phạt hủy mốc trung bình (%)"
                extra="Ví dụ 50% phạt, hoàn trả 50% tiền"
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>

              <Form.Item
                name="farTierPercent"
                label="Phí phạt hủy mốc xa (hủy trước mốc trung bình) (%)"
                extra="0% nghĩa là được hoàn lại 100% tiền nếu hủy sớm"
                style={{ gridColumn: 'span 2' }}
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
              </Form.Item>
            </div>

            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={savingCancelPolicy}>
              Lưu chính sách hủy phòng
            </Button>
          </Form>
        </Card>
      ),
    },
    {
      key: '4',
      label: (
        <span>
          <TeamOutlined /> Phụ thu trẻ em
        </span>
      ),
      children: (
        <Card title={<><TeamOutlined /> Chính sách phụ thu trẻ em & Người ở thêm</>} style={{ maxWidth: 660 }}>
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
              loading={savingChildrenPolicy}
              style={{ alignSelf: 'flex-start' }}
              onClick={handleSaveChildrenPolicy}
            >
              Lưu chính sách trẻ em
            </Button>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1050 }}>
      <h1 style={{ marginBottom: 4 }}>Cài đặt & Chính sách</h1>
      <p style={{ color: '#8a93a5', marginBottom: 20 }}>
        Quản lý tài khoản thanh toán, giờ nhận/trả phòng chuẩn, chính sách phụ thu trễ giờ, phụ thu trẻ em và quy định hủy phòng.
      </p>

      <Tabs defaultActiveKey="1" items={tabItems} size="large" />
    </div>
  );
};

export default PaymentSettings;
