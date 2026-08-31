import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Row,
  Col,
  Card,
  Tag,
  message,
  Space,
  Spin,
  Tooltip,
  Alert,
  Radio,
  Checkbox,
  QRCode
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
  HomeOutlined,
  TeamOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  WarningOutlined,
  WalletOutlined,
  QrcodeOutlined,
  BankOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  ArrowRightOutlined,
  SyncOutlined,
  CheckCircleFilled,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import api from '../../services/api';
import zalopayLogo from '../../assets/payment/zalopay.svg';
import vnpayLogo from '../../assets/payment/vnpay.svg';
import vietqrLogo from '../../assets/payment/vietqr.svg';
import { buildVietQrPayload, findBankByBin, toTransferText } from '../../utils/vietqr';
import { createGatewayOrder, confirmPayment } from '../../services/paymentService';
import { getPaymentSettings, type PaymentSettings } from '../../services/settingsService';
import '../Booking/Payment.css';

const { Option } = Select;
const { RangePicker } = DatePicker;

// Danh sách ngày lễ dương lịch cố định hàng năm (MM-DD)
const FIXED_HOLIDAYS_VI: Record<string, string> = {
  '01-01': 'Tết Dương Lịch',
  '04-30': 'Giải phóng miền Nam (30/4)',
  '05-01': 'Quốc tế Lao động (1/5)',
  '09-02': 'Quốc khánh (2/9)',
  '12-25': 'Lễ Giáng sinh (Noel)'
};

// Các khoảng ngày lễ âm lịch / biến đổi theo từng năm (YYYY-MM-DD)
const VARIABLE_HOLIDAYS_VI = [
  // Năm 2025
  { start: '2025-01-29', end: '2025-02-02', name: 'Tết Nguyên Đán 2025' },
  { start: '2025-04-07', end: '2025-04-07', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2026
  { start: '2026-02-17', end: '2026-02-21', name: 'Tết Nguyên Đán 2026' },
  { start: '2026-04-26', end: '2026-04-26', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' },

  // Năm 2027
  { start: '2027-02-06', end: '2027-02-10', name: 'Tết Nguyên Đán 2027' },
  { start: '2027-04-16', end: '2027-04-16', name: 'Giỗ tổ Hùng Vương (10/3 ÂL)' }
];

interface RoomRowItem {
  key: string;
  roomTypeId: number | null;
  roomIds: number[];
  quantity: number;
  adults: number;
  children: number;
  childrenAges: number[];
}

interface AdminCreateBookingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialRoomId?: number | null;
  initialDate?: Dayjs | null;
}

type PaymentMethodType = 'cash' | 'vnpay' | 'zalopay' | 'bank_transfer' | 'unpaid';
type PaymentTierType = 'full' | 'deposit';

export const AdminCreateBookingModal: React.FC<AdminCreateBookingModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialRoomId,
  initialDate
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [dbHolidays, setDbHolidays] = useState<any[]>([]);
  const [bankSettings, setBankSettings] = useState<PaymentSettings | null>(null);

  const [roomRows, setRoomRows] = useState<RoomRowItem[]>([
    { key: '1', roomTypeId: null, roomIds: [], quantity: 1, adults: 2, children: 0, childrenAges: [] }
  ]);

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash');
  const [paymentTier, setPaymentTier] = useState<PaymentTierType>('full');
  const [autoCheckIn, setAutoCheckIn] = useState<boolean>(false);

  // Gateway / VietQR Active Modal state
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrModalData, setQrModalData] = useState<{
    bookingId: number;
    paymentId: number;
    guestName: string;
    roomTypeName: string;
    checkIn: string;
    checkOut: string;
    method: 'vnpay' | 'zalopay' | 'bank_transfer';
    orderId: string;
    paymentUrl: string;
    amount: number;
    expiresAt: string | null;
    vietQrPayload?: string;
  } | null>(null);
  const [qrCountdown, setQrCountdown] = useState<number>(900); // 15 mins
  const [paymentSuccessDone, setPaymentSuccessDone] = useState(false);

  const pollTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);

  // Watch dateRange
  const dateRange = Form.useWatch('dateRange', form);

  useEffect(() => {
    if (open) {
      loadInitialData();
    } else {
      form.resetFields();
      setAllBookings([]);
      setRoomRows([{ key: '1', roomTypeId: null, roomIds: [], quantity: 1, adults: 2, children: 0, childrenAges: [] }]);
      setPaymentMethod('cash');
      setPaymentTier('full');
      setAutoCheckIn(false);
      setQrModalVisible(false);
      setQrModalData(null);
      setPaymentSuccessDone(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    }
  }, [open]);

  // Live countdown timer effect
  useEffect(() => {
    if (qrModalVisible && qrCountdown > 0) {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = setInterval(() => {
        setQrCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [qrModalVisible]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [typesRes, roomsRes, bookingsRes, bankRes, holidaysRes]: any[] = await Promise.all([
        api.get('/rooms/types'),
        api.get('/rooms'),
        api.get('/bookings').catch(() => ({ data: [] })),
        getPaymentSettings().catch(() => null),
        api.get('/holidays').catch(() => ({ data: [] }))
      ]);

      const typesList = Array.isArray(typesRes) ? typesRes : (typesRes?.data || typesRes?.data?.data || []);
      const roomsList = Array.isArray(roomsRes) ? roomsRes : (roomsRes?.data || roomsRes?.data?.data || []);
      const bookingsList = Array.isArray(bookingsRes) ? bookingsRes : (bookingsRes?.data || bookingsRes?.data?.data || []);
      const holidaysList = Array.isArray(holidaysRes) ? holidaysRes : (holidaysRes?.data || holidaysRes?.data?.data || []);

      setRoomTypes(typesList);
      setAllRooms(roomsList);
      setAllBookings(bookingsList);
      setDbHolidays(holidaysList);
      if (bankRes?.data) {
        setBankSettings(bankRes.data);
      }

      const initialDateRange = initialDate ? [initialDate, initialDate.add(1, 'day')] : [dayjs(), dayjs().add(1, 'day')];

      let defaultRoomIds: number[] = [];
      let defaultRoomTypeId: number | null = null;

      if (initialRoomId) {
        const found = roomsList.find((r: any) => r.id === initialRoomId);
        if (found) {
          defaultRoomIds = [found.id];
          defaultRoomTypeId = found.roomTypeId || found.room_type_id || null;
        }
      }

      setRoomRows([
        {
          key: '1',
          roomTypeId: defaultRoomTypeId,
          roomIds: defaultRoomIds,
          quantity: Math.max(1, defaultRoomIds.length),
          adults: 2,
          children: 0,
          childrenAges: []
        }
      ]);

      form.setFieldsValue({
        dateRange: initialDateRange,
        notes: 'Đặt phòng trực tiếp tại quầy Admin'
      });
    } catch (err) {
      console.error('Error loading initial data for booking creation:', err);
      message.error('Không tải được danh sách hạng phòng & số phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRoomRow = () => {
    setRoomRows(prev => [
      ...prev,
      {
        key: String(Date.now() + Math.random()),
        roomTypeId: null,
        roomIds: [],
        quantity: 1,
        adults: 2,
        children: 0,
        childrenAges: []
      }
    ]);
  };

  const handleRemoveRoomRow = (key: string) => {
    if (roomRows.length <= 1) {
      message.warning('Đơn đặt phòng phải chứa ít nhất 1 phòng');
      return;
    }
    setRoomRows(prev => prev.filter(r => r.key !== key));
  };

  const handleRoomRowChange = (key: string, field: keyof RoomRowItem, value: any) => {
    setRoomRows(prev =>
      prev.map(item => {
        if (item.key === key) {
          const updated = { ...item, [field]: value };
          if (field === 'roomTypeId') {
            updated.roomIds = []; // Reset physical rooms when type changes
          }
          if (field === 'roomIds') {
            const ids = Array.isArray(value) ? value : value ? [value] : [];
            updated.roomIds = ids;
            if (ids.length > 0) {
              updated.quantity = ids.length;
            }
          }
          if (field === 'quantity') {
            const q = Math.max(1, Number(value || 1));
            updated.quantity = q;
            if (updated.roomIds.length > q) {
              updated.roomIds = updated.roomIds.slice(0, q);
            }
          }
          if (field === 'children') {
            const count = Math.max(0, Number(value || 0));
            const newAges = [...item.childrenAges];
            if (newAges.length < count) {
              while (newAges.length < count) newAges.push(4);
            } else if (newAges.length > count) {
              newAges.splice(count);
            }
            updated.childrenAges = newAges;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRowChildAgeChange = (key: string, ageIndex: number, ageValue: number) => {
    setRoomRows(prev =>
      prev.map(item => {
        if (item.key === key) {
          const newAges = [...item.childrenAges];
          newAges[ageIndex] = ageValue;
          return { ...item, childrenAges: newAges };
        }
        return item;
      })
    );
  };

  // Filter available physical rooms for a specific roomTypeId
  const getAvailablePhysicalRooms = (typeId: number | null, currentRowKey?: string) => {
    const otherSelectedRoomIds = roomRows
      .filter((r) => r.key !== currentRowKey)
      .flatMap((r) => r.roomIds || []);

    return allRooms.filter((room: any) => {
      // 0. Exclude room if already selected in another row
      if (otherSelectedRoomIds.includes(Number(room.id))) {
        return false;
      }

      // 1. Match typeId if selected
      if (typeId) {
        const rTypeId = room.roomTypeId || room.room_type_id;
        if (Number(rTypeId) !== Number(typeId)) return false;
      }

      // 2. Hide occupied / maintenance
      const status = String(room.status || '').toLowerCase();
      if (['occupied', 'maintenance', 'out_of_service', 'cleaning', 'bảo trì', 'đang ở'].includes(status)) {
        return false;
      }

      // 3. Hide if booked during dateRange
      if (dateRange && dateRange[0] && dateRange[1]) {
        const selectIn = dateRange[0].format('YYYY-MM-DD');
        const selectOut = dateRange[1].format('YYYY-MM-DD');

        const isBooked = allBookings.some((b: any) => {
          const bStatus = String(b.status || b.bookingStatus || '').toLowerCase();
          if (['cancelled', 'canceled', 'checked_out', 'no_show', 'đã hủy', 'đã trả'].includes(bStatus)) {
            return false;
          }

          const bRoomId = b.roomId || b.room_id;
          if (Number(bRoomId) !== Number(room.id)) return false;

          const bIn = dayjs(b.checkIn || b.check_in).format('YYYY-MM-DD');
          const bOut = dayjs(b.checkOut || b.check_out).format('YYYY-MM-DD');

          return !(bOut <= selectIn || bIn >= selectOut);
        });

        if (isBooked) return false;
      }

      return true;
    });
  };

  // Price & Surcharge calculations across all room rows
  const calculatePreviewPrice = () => {
    const stayDates: string[] = [];
    if (dateRange && dateRange[0] && dateRange[1]) {
      let cur = dateRange[0].clone();
      const end = dateRange[1];
      while (cur.isBefore(end, 'day')) {
        stayDates.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }
    }
    const nights = Math.max(1, stayDates.length);

    let baseRoomPrice = 0;
    let totalHolidaySurcharge = 0;
    let totalWeekendSurcharge = 0;
    let totalExtraGuestSurcharge = 0;
    let totalRoomsCount = 0;
    let totalAdults = 0;
    let totalChildren = 0;

    const holidayDetailsMap = new Map<string, number>();
    const weekendDetailsMap = new Map<string, number>();

    const rowsAnalysis = roomRows.map(row => {
      const q = Math.max(1, row.quantity || 1);
      totalRoomsCount += q;
      totalAdults += (row.adults || 1) * q;
      totalChildren += (row.children || 0) * q;

      const typeObj = roomTypes.find((t: any) => Number(t.id) === Number(row.roomTypeId));
      const pricePerNight = Number(typeObj?.defaultPrice || typeObj?.price || 0);

      const adultCap = Number(typeObj?.adultCapacity ?? typeObj?.capacity ?? 2);
      const childCap = Number(typeObj?.childCapacity ?? 1);
      const maxAllowedGuestsPerRoom = adultCap + 1;

      const extraAdultFee = Number(typeObj?.extraAdultFee ?? 200000);
      const extraChildFee = Number(typeObj?.extraChildFee ?? 100000);

      const childrenOver12Count = (row.childrenAges || []).filter((age) => typeof age === 'number' && age >= 12).length;
      const effectiveAdults = (row.adults || 1) + childrenOver12Count;
      const effectiveChildren = Math.max(0, (row.children || 0) - childrenOver12Count);
      const totalGuestsPerRoom = effectiveAdults + effectiveChildren;

      const stdAdultCapPerRoom = adultCap;
      const stdChildCapPerRoom = childCap;

      const exceedsMaxLimit = totalGuestsPerRoom > maxAllowedGuestsPerRoom;
      const hasExtraGuest = totalGuestsPerRoom > stdAdultCapPerRoom;

      const extraAdultsPerRoom = Math.max(0, effectiveAdults - stdAdultCapPerRoom);
      const extraChildrenPerRoom = Math.max(0, effectiveChildren - stdChildCapPerRoom);

      const lineSurchargePerNight = (extraAdultsPerRoom * extraAdultFee) + (extraChildrenPerRoom * extraChildFee);
      const lineExtraGuestSurcharge = nights * lineSurchargePerNight * q;
      totalExtraGuestSurcharge += lineExtraGuestSurcharge;

      const lineBasePrice = nights * pricePerNight * q;
      baseRoomPrice += lineBasePrice;

      // Calculate Holiday & Weekend surcharges for this room type across all stay dates
      let lineHolidaySurcharge = 0;
      let lineWeekendSurcharge = 0;

      stayDates.forEach((nightStr) => {
        const d = dayjs(nightStr);
        const dayOfWeek = d.day();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const mmdd = nightStr.slice(5, 10);

        // Check in active DB holidays
        const matchedDb = dbHolidays.find((h: any) => {
          const s = String(h.startDate || '').slice(0, 10);
          const e = String(h.endDate || '').slice(0, 10);
          if (s <= nightStr && nightStr <= e) return true;
          if (h.isRecurring && h.calendarType === 'solar') {
            const sm = s.slice(5, 10);
            const em = e.slice(5, 10);
            if (sm <= em) return sm <= mmdd && mmdd <= em;
          }
          return false;
        });

        const variableH = VARIABLE_HOLIDAYS_VI.find(h => h.start <= nightStr && nightStr <= h.end);
        const fixedH = FIXED_HOLIDAYS_VI[mmdd];

        const isHoliday = Boolean(matchedDb || variableH || fixedH);
        const holidayName = matchedDb?.name || variableH?.name || fixedH || 'Ngày lễ';
        const holidayPercent = matchedDb ? Number(matchedDb.surchargePercent || 10) : 10;

        if (isHoliday) {
          const sc = Math.round(pricePerNight * (holidayPercent / 100)) * q;
          lineHolidaySurcharge += sc;
          const key = `${holidayName} (+${holidayPercent}%)`;
          holidayDetailsMap.set(key, (holidayDetailsMap.get(key) || 0) + sc);
        } else if (isSunday || isSaturday) {
          const sc = Math.round(pricePerNight * 0.10) * q;
          lineWeekendSurcharge += sc;
          const key = `Phụ thu cuối tuần (${isSunday ? 'Chủ nhật' : 'Thứ 7'}) (+10%)`;
          weekendDetailsMap.set(key, (weekendDetailsMap.get(key) || 0) + sc);
        }
      });

      totalHolidaySurcharge += lineHolidaySurcharge;
      totalWeekendSurcharge += lineWeekendSurcharge;

      return {
        row,
        typeObj,
        adultCap,
        childCap,
        maxAllowedGuestsPerRoom,
        extraAdultFee,
        extraChildFee,
        totalGuestsPerRoom,
        effectiveAdults,
        effectiveChildren,
        childrenOver12Count,
        exceedsMaxLimit,
        hasExtraGuest,
        extraAdultsPerRoom,
        extraChildrenPerRoom,
        lineSurchargeTotal: lineExtraGuestSurcharge
      };
    });

    const totalPrice = baseRoomPrice + totalHolidaySurcharge + totalWeekendSurcharge + totalExtraGuestSurcharge;

    return {
      nights,
      stayDates,
      baseRoomPrice,
      totalHolidaySurcharge,
      totalWeekendSurcharge,
      totalExtraGuestSurcharge,
      holidayDetailsList: Array.from(holidayDetailsMap.entries()),
      weekendDetailsList: Array.from(weekendDetailsMap.entries()),
      totalPrice,
      totalRoomsCount,
      totalAdults,
      totalChildren,
      rowsAnalysis
    };
  };

  const {
    nights,
    baseRoomPrice,
    totalHolidaySurcharge,
    totalWeekendSurcharge,
    totalExtraGuestSurcharge,
    holidayDetailsList,
    weekendDetailsList,
    totalPrice,
    totalRoomsCount,
    totalAdults,
    totalChildren,
    rowsAnalysis
  } = calculatePreviewPrice();

  // Quy chuẩn tiền cọc của hệ thống backend: Đúng 30% tổng tiền
  const requiredDepositAmount = Math.ceil(totalPrice * 0.3);

  // Calculated payable amount based on payment tier (Full or Deposit)
  const payableAmount =
    paymentMethod === 'unpaid'
      ? 0
      : paymentTier === 'full'
      ? totalPrice
      : requiredDepositAmount;

  const isCheckInToday = dateRange && dateRange[0] ? dateRange[0].isSame(dayjs(), 'day') : false;

  // Cleanup polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  // Polling check for gateway QR payment
  const startPaymentPolling = (_bookingId: number, paymentId: number) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const payRes: any = await api.get(`/payments/${paymentId}`);
        const paymentData = payRes?.data || payRes;
        if (['paid', 'deposit_paid'].includes(paymentData?.paymentStatus)) {
          clearInterval(pollTimerRef.current);
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          setPaymentSuccessDone(true);
          message.success('Giao dịch thanh toán đã thành công!');
          setTimeout(() => {
            setQrModalVisible(false);
            onSuccess();
            onClose();
          }, 1800);
        }
      } catch (pollErr) {
        console.warn('Polling payment status error:', pollErr);
      }
    }, 2500);
  };

  // Submit and Create Booking
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!values.dateRange || !values.dateRange[0] || !values.dateRange[1]) {
        message.error('Vui lòng chọn khoảng ngày nhận và trả phòng');
        return;
      }

      // Check room selection validation
      const invalidRows = roomRows.filter(r => !r.roomTypeId);
      if (invalidRows.length > 0) {
        message.error('Vui lòng chọn Hạng phòng cho tất cả các dòng!');
        return;
      }

      // Check max 1 extra guest limit per room
      const exceededRows = rowsAnalysis.filter(a => a.exceedsMaxLimit);
      if (exceededRows.length > 0) {
        message.error('Mỗi phòng chỉ được phép ở tối đa thêm 1 khách phát sinh. Vui lòng giảm số khách hoặc thêm phòng mới!');
        return;
      }

      setSubmitting(true);
      const checkInStr = values.dateRange[0].format('YYYY-MM-DD');
      const checkOutStr = values.dateRange[1].format('YYYY-MM-DD');

      const allChildrenAgesFlat = roomRows.flatMap(r => r.childrenAges || []);

      // Prepare payload
      const payload: any = {
        guestName: String(values.guestName).trim(),
        guestPhone: String(values.guestPhone).trim(),
        guestEmail: values.guestEmail ? String(values.guestEmail).trim() : null,
        checkIn: checkInStr,
        checkOut: checkOutStr,
        adults: totalAdults > 0 ? totalAdults : 1,
        children: totalChildren,
        childrenAges: allChildrenAgesFlat,
        notes: values.notes ? String(values.notes).trim() : 'Đặt phòng trực tiếp tại quầy',
        status: paymentMethod === 'cash' ? 'confirmed' : 'pending'
      };

      // Expand room rows: if roomIds are specified, create items with individual roomId
      const expandedRooms: any[] = [];
      roomRows.forEach((r) => {
        const q = Math.max(1, Number(r.quantity || 1));
        const selectedIds = r.roomIds || [];
        if (selectedIds.length > 0) {
          selectedIds.forEach((rid) => {
            expandedRooms.push({
              roomTypeId: Number(r.roomTypeId),
              roomId: Number(rid),
              quantity: 1,
              adults: Number(r.adults || 1),
              children: Number(r.children || 0),
              childrenAges: r.childrenAges || []
            });
          });
          const rem = q - selectedIds.length;
          if (rem > 0) {
            expandedRooms.push({
              roomTypeId: Number(r.roomTypeId),
              roomId: null,
              quantity: rem,
              adults: Number(r.adults || 1),
              children: Number(r.children || 0),
              childrenAges: r.childrenAges || []
            });
          }
        } else {
          expandedRooms.push({
            roomTypeId: Number(r.roomTypeId),
            roomId: null,
            quantity: q,
            adults: Number(r.adults || 1),
            children: Number(r.children || 0),
            childrenAges: r.childrenAges || []
          });
        }
      });

      if (expandedRooms.length === 1 && !expandedRooms[0].roomId && expandedRooms[0].quantity === 1) {
        const single = expandedRooms[0];
        payload.roomTypeId = Number(single.roomTypeId);
        payload.roomId = null;
        payload.roomQuantity = 1;
        payload.adults = Number(single.adults || 1);
        payload.children = Number(single.children || 0);
        payload.childrenAges = single.childrenAges || [];
      } else {
        payload.rooms = expandedRooms;
        payload.roomQuantity = expandedRooms.reduce((sum, r) => sum + Number(r.quantity || 1), 0);
      }

      // Step 1: Create Booking
      const createRes: any = await api.post('/bookings', payload);
      const createdBooking = createRes?.data || createRes;
      const createdId = createdBooking?.id || createdBooking?.bookingId;
      const paymentInfo = createdBooking?.payment;
      const paymentId = paymentInfo?.id;

      const realTotalAmount = Number(paymentInfo?.totalAmount || createdBooking?.totalAmount || totalPrice);
      const realRequiredDeposit = Number(paymentInfo?.requiredDepositAmount || Math.ceil(realTotalAmount * 0.3));
      const realRemainingAmount = Number(paymentInfo?.remainingAmount || realTotalAmount);
      const actualPaymentAmount = paymentTier === 'deposit' ? realRequiredDeposit : realRemainingAmount;

      const firstType = roomTypes.find(t => Number(t.id) === Number(roomRows[0]?.roomTypeId));
      const roomSummaryName = roomRows.length > 1
        ? `${roomRows.length} hạng phòng (${totalRoomsCount} phòng)`
        : `${firstType?.typeName || 'Phòng nghỉ'} (${totalRoomsCount} phòng)`;

      // Step 2: Auto declare guest identity card if provided
      if (createdId && values.identityCard && String(values.identityCard).trim()) {
        try {
          await api.post(`/bookings/${createdId}/guests`, {
            guests: [
              {
                fullName: String(values.guestName).trim(),
                identityCard: String(values.identityCard).trim(),
                phone: String(values.guestPhone).trim()
              }
            ]
          });
        } catch (guestErr) {
          console.warn('Cannot auto-save guest identity card:', guestErr);
        }
      }

      // Step 3: Handle Payment Method
      if (paymentMethod === 'cash') {
        if (paymentId && actualPaymentAmount > 0) {
          await api.post(`/payments/${paymentId}/pay`, {
            paymentMethod: 'cash',
            amount: actualPaymentAmount
          });
        }

        // If Auto Check-in selected
        if (autoCheckIn && isCheckInToday) {
          try {
            await api.patch(`/bookings/${createdId}/check-in`, {
              actualCheckInTime: new Date().toISOString()
            });
            message.success(`Đã tạo đơn #${createdId}, thu tiền mặt ${formatPrice(actualPaymentAmount)} và Nhận phòng (Check-in) thành công!`);
          } catch (ciErr) {
            console.warn('Check-in error after booking creation:', ciErr);
            message.success(`Tạo đơn #${createdId} và thu tiền mặt thành công! (Vui lòng bấm Check-in thủ công tại bảng quản lý)`);
          }
        } else {
          message.success(`Tạo đơn #${createdId} thành công! Đã thu ${formatPrice(actualPaymentAmount)} tiền mặt.`);
        }

        onSuccess();
        onClose();
      } else if (paymentMethod === 'zalopay' || paymentMethod === 'vnpay') {
        if (!paymentId) {
          message.error('Không tìm thấy bản ghi thanh toán cho đơn này');
          return;
        }

        const gatewayRes = await createGatewayOrder(paymentId, {
          paymentMethod,
          amount: actualPaymentAmount,
          returnContext: window.location.pathname.startsWith('/staff')
            ? 'staff_bookings'
            : 'admin_bookings'
        });

        const gData = gatewayRes?.data;
        setQrModalData({
          bookingId: createdId,
          paymentId,
          guestName: String(values.guestName).trim(),
          roomTypeName: roomSummaryName,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          method: paymentMethod,
          orderId: gData.orderId,
          paymentUrl: gData.paymentUrl,
          amount: actualPaymentAmount,
          expiresAt: gData.expiresAt
        });
        setQrCountdown(900);
        setQrModalVisible(true);
        startPaymentPolling(createdId, paymentId);

        // Tự động chuyển/mở ngay tab thanh toán Sandbox của ZaloPay / VNPay
        if (gData.paymentUrl) {
          window.open(gData.paymentUrl, '_blank');
        }
      } else if (paymentMethod === 'bank_transfer') {
        if (!bankSettings) {
          message.warning('Chưa có cấu hình tài khoản ngân hàng khách sạn, vui lòng kiểm tra lại Cài đặt.');
        }

        const transferInfo = `BOOKING ${createdId} ${toTransferText(values.guestName)}`;
        const vietQr = bankSettings
          ? buildVietQrPayload({
              bankBin: bankSettings.bankBin,
              accountNumber: bankSettings.accountNumber,
              amount: actualPaymentAmount,
              addInfo: transferInfo
            })
          : '';

        setQrModalData({
          bookingId: createdId,
          paymentId: paymentId || 0,
          guestName: String(values.guestName).trim(),
          roomTypeName: roomSummaryName,
          checkIn: checkInStr,
          checkOut: checkOutStr,
          method: 'bank_transfer',
          orderId: `TRANS-${createdId}`,
          paymentUrl: '',
          amount: actualPaymentAmount,
          expiresAt: null,
          vietQrPayload: vietQr
        });
        setQrCountdown(900);
        setQrModalVisible(true);
        if (paymentId) startPaymentPolling(createdId, paymentId);
      } else {
        // Unpaid
        message.success(`Tạo đơn đặt phòng #${createdId} thành công (Trạng thái: Chưa thanh toán)!`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Error creating admin booking:', err);
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn đặt phòng');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualConfirmGatewayPayment = async () => {
    if (!qrModalData?.paymentId) return;
    try {
      setSubmitting(true);
      if (qrModalData.method === 'bank_transfer') {
        await api.post(`/payments/${qrModalData.paymentId}/pay`, {
          paymentMethod: 'bank_transfer',
          amount: qrModalData.amount
        });
      } else {
        await confirmPayment(qrModalData.paymentId, {
          amount: qrModalData.amount,
          transactionCode: qrModalData.orderId,
          gatewayOrderId: qrModalData.orderId
        });
      }
      message.success('Đã xác nhận thanh toán thành công!');
      setQrModalVisible(false);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể xác nhận thanh toán');
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount) + ' VNĐ';
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`Đã sao chép ${label}`);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // QR Code Value for Sandbox / Real
  const renderGatewayQrCode = () => {
    if (!qrModalData) return null;

    if (qrModalData.method === 'bank_transfer') {
      return (
        <div style={{ textAlign: 'center' }}>
          {qrModalData.vietQrPayload ? (
            <div className="qr-frame" style={{ margin: '0 auto', display: 'inline-block' }}>
              <span className="qr-corner tl" />
              <span className="qr-corner tr" />
              <span className="qr-corner bl" />
              <span className="qr-corner br" />
              <QRCode
                value={qrModalData.vietQrPayload}
                size={240}
                icon={vietqrLogo}
                iconSize={44}
                bordered={false}
              />
              <span className="qr-scanline" />
            </div>
          ) : (
            <Alert type="warning" message="Chưa thiết lập thông tin ngân hàng trong Cài đặt" />
          )}
          <div style={{ marginTop: 12, fontSize: 13, color: '#e2e8f0' }}>
            <SafetyCertificateOutlined style={{ marginRight: 6, color: '#38bdf8' }} />
            Quét bằng ứng dụng ngân hàng bất kỳ qua Napas 247
          </div>
        </div>
      );
    }

    // VNPay or ZaloPay Gateway
    const isZalo = qrModalData.method === 'zalopay';
    const qrData = qrModalData.paymentUrl || (isZalo
      ? `zalopay://pay?txn=${qrModalData.orderId}&amount=${qrModalData.amount}`
      : `vnpay://payment?txn=${qrModalData.orderId}&amount=${qrModalData.amount}`);

    return (
      <div style={{ textAlign: 'center' }}>
        <div className="qr-frame" style={{ margin: '0 auto', display: 'inline-block' }}>
          <span className="qr-corner tl" />
          <span className="qr-corner tr" />
          <span className="qr-corner bl" />
          <span className="qr-corner br" />
          <QRCode
            value={qrData}
            size={240}
            icon={isZalo ? zalopayLogo : vnpayLogo}
            iconSize={46}
            bordered={false}
          />
          <span className="qr-scanline" />
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: '#e2e8f0' }}>
          <QrcodeOutlined style={{ marginRight: 6, color: '#38bdf8' }} />
          Quét bằng Camera điện thoại hoặc app {isZalo ? 'ZaloPay' : 'VNPay / Ngân hàng'}
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: '#0f172a' }}>
            <PlusOutlined style={{ color: '#2563eb' }} />
            <span>Tạo đơn đặt phòng tại quầy Admin</span>
          </div>
        }
        open={open && !qrModalVisible}
        onCancel={onClose}
        footer={[
          <Button key="cancel" onClick={onClose} disabled={submitting}>
            Hủy bỏ
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={submitting}
            onClick={handleSubmit}
            style={{ backgroundColor: '#2563eb', borderColor: '#2563eb' }}
          >
            {paymentMethod === 'cash'
              ? `Xác nhận & Thu tiền mặt (${formatPrice(payableAmount)})`
              : paymentMethod === 'zalopay' || paymentMethod === 'vnpay'
              ? `Tạo đơn & Hiện mã QR ${paymentMethod === 'zalopay' ? 'ZaloPay' : 'VNPay'} (${formatPrice(payableAmount)})`
              : paymentMethod === 'bank_transfer'
              ? `Tạo đơn & Hiện mã VietQR (${formatPrice(payableAmount)})`
              : `Xác nhận tạo đơn (${totalRoomsCount} phòng)`}
          </Button>
        ]}
        width={920}
        destroyOnHidden
      >
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
            {/* Section 1: Thông tin khách hàng */}
            <Card
              size="small"
              title={
                <span style={{ fontSize: 14, fontWeight: 650, color: '#1e293b' }}>
                  <UserOutlined style={{ marginRight: 6, color: '#3b82f6' }} />
                  1. Thông tin khách hàng
                </span>
              }
              style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="guestName"
                    label="Họ và tên khách hàng"
                    rules={[{ required: true, message: 'Vui lòng nhập tên khách hàng!' }]}
                  >
                    <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: Nguyễn Văn A" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="guestPhone"
                    label="Số điện thoại"
                    rules={[
                      { required: true, message: 'Vui lòng nhập số điện thoại!' },
                      { pattern: /^[0-9]{9,11}$/, message: 'Số điện thoại không hợp lệ!' }
                    ]}
                  >
                    <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: 0987654321" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="guestEmail" label="Địa chỉ Email (tùy chọn)">
                    <Input prefix={<MailOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: khachhang@gmail.com" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="identityCard" label="Số CCCD / Hộ chiếu (để check-in)">
                    <Input prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />} placeholder="Ví dụ: 001203004567" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section 2: Khoảng ngày & Danh sách chọn phòng */}
            <Card
              size="small"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 650, color: '#1e293b' }}>
                    <HomeOutlined style={{ marginRight: 6, color: '#3b82f6' }} />
                    2. Khoảng ngày & Danh sách phòng chọn
                  </span>
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleAddRoomRow}
                    disabled={roomTypes.length > 0 && roomRows.length >= roomTypes.length}
                    style={{ color: '#2563eb', borderColor: '#bfdbfe' }}
                  >
                    Thêm hạng phòng
                  </Button>
                </div>
              }
              style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}
            >
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={24}>
                  <Form.Item
                    name="dateRange"
                    label="Khoảng ngày lưu trú (Check-in ➔ Check-out)"
                    rules={[{ required: true, message: 'Chọn khoảng ngày lưu trú!' }]}
                  >
                    <RangePicker
                      style={{ width: '100%' }}
                      format="DD/MM/YYYY"
                      disabledDate={(current) => current && current < dayjs().startOf('day')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ fontWeight: 600, fontSize: 13, color: '#334155', marginBottom: 10 }}>
                Cấu hình các hạng phòng ({roomRows.length} hạng phòng):
              </div>

              {roomRows.map((row, index) => {
                const usedTypeIds = roomRows
                  .filter((r) => r.key !== row.key && r.roomTypeId)
                  .map((r) => Number(r.roomTypeId));

                const availableTypes = roomTypes.filter((t) => !usedTypeIds.includes(Number(t.id)));
                const availableRooms = getAvailablePhysicalRooms(row.roomTypeId, row.key);
                const analysis = rowsAnalysis.find(a => a.row.key === row.key);

                return (
                  <div
                    key={row.key}
                    style={{
                      padding: '14px 16px',
                      background: '#f8fafc',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      marginBottom: 14
                    }}
                  >
                    {/* Row 1: Hạng phòng, Số lượng, Số phòng cụ thể & Nút Xóa */}
                    <Row gutter={12} align="middle">
                      <Col span={8}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                          Hạng phòng #{index + 1} <span style={{ color: '#ef4444' }}>*</span>
                        </div>
                        <Select
                          placeholder="Chọn hạng phòng"
                          style={{ width: '100%' }}
                          value={row.roomTypeId}
                          onChange={(val) => handleRoomRowChange(row.key, 'roomTypeId', val)}
                        >
                          {availableTypes.map((t) => (
                            <Option key={t.id} value={t.id}>
                              {t.typeName} — {formatPrice(t.defaultPrice || t.price || 0)}/đêm
                            </Option>
                          ))}
                        </Select>
                      </Col>

                      <Col span={4}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                          Số lượng phòng <span style={{ color: '#ef4444' }}>*</span>
                        </div>
                        <InputNumber
                          min={1}
                          max={10}
                          style={{ width: '100%' }}
                          value={row.quantity}
                          onChange={(val) => handleRoomRowChange(row.key, 'quantity', val || 1)}
                        />
                      </Col>

                      <Col span={10}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                          Chọn số phòng cụ thể (Tùy chọn)
                        </div>
                        <Select
                          mode="multiple"
                          placeholder="Tự động gán phòng trống"
                          style={{ width: '100%' }}
                          value={row.roomIds}
                          allowClear
                          disabled={!row.roomTypeId}
                          maxCount={row.quantity}
                          maxTagCount="responsive"
                          tagRender={(tagProps) => {
                            const { label, closable, onClose } = tagProps;
                            const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
                              event.preventDefault();
                              event.stopPropagation();
                            };
                            return (
                              <Tag
                                color="blue"
                                onMouseDown={onPreventMouseDown}
                                closable={closable}
                                onClose={onClose}
                                style={{
                                  margin: '1px 3px 1px 0',
                                  fontSize: 12,
                                  fontWeight: 500,
                                  borderRadius: 4,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  height: 24,
                                  lineHeight: '22px'
                                }}
                              >
                                {label}
                              </Tag>
                            );
                          }}
                          onChange={(val) => handleRoomRowChange(row.key, 'roomIds', val)}
                        >
                          {availableRooms.map((r) => (
                            <Option key={r.id} value={r.id} label={`P.${r.roomNumber || r.room_number}`}>
                              Phòng {r.roomNumber || r.room_number} {r.floor ? `(Tầng ${r.floor})` : ''}
                            </Option>
                          ))}
                        </Select>
                      </Col>

                      <Col span={2} style={{ textAlign: 'center', paddingTop: 18 }}>
                        {roomRows.length > 1 && (
                          <Tooltip title="Xóa dòng phòng này">
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveRoomRow(row.key)}
                            />
                          </Tooltip>
                        )}
                      </Col>
                    </Row>

                    {/* Row 2: Chọn Số lượng Người lớn & Trẻ em cho riêng phòng này */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
                      <Row gutter={12} align="middle">
                        <Col span={8}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                            <TeamOutlined style={{ color: '#2563eb' }} />
                            <span>Người lớn:</span>
                            <InputNumber
                              size="small"
                              min={1}
                              max={10}
                              style={{ width: 70 }}
                              value={row.adults}
                              onChange={(val) => handleRoomRowChange(row.key, 'adults', val || 1)}
                            />
                            <span style={{ fontSize: 11, color: '#64748b' }}>người/phòng</span>
                          </div>
                        </Col>

                        <Col span={8}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155' }}>
                            <span>Trẻ em:</span>
                            <InputNumber
                              size="small"
                              min={0}
                              max={10}
                              style={{ width: 70 }}
                              value={row.children}
                              onChange={(val) => handleRoomRowChange(row.key, 'children', val || 0)}
                            />
                            <span style={{ fontSize: 11, color: '#64748b' }}>bé/phòng</span>
                          </div>
                        </Col>

                        <Col span={8}>
                          <span style={{ fontSize: 11, color: '#0284c7' }}>
                            Khách ở quy đổi: {analysis ? analysis.effectiveAdults : row.adults} NL {analysis && analysis.effectiveChildren > 0 ? `+ ${analysis.effectiveChildren} TE` : ''}
                            {analysis && ` (Chuẩn: ${analysis.adultCap} NL, Tối đa +1: ${analysis.maxAllowedGuestsPerRoom} người)`}
                          </span>
                        </Col>
                      </Row>

                      {analysis && analysis.childrenOver12Count > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#0369a1', background: '#f0f9ff', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
                          ℹ️ Có {analysis.childrenOver12Count} trẻ em từ 12 tuổi trở lên được tính giá như người lớn ({analysis.effectiveAdults} NL quy đổi).
                        </div>
                      )}

                      {/* Hard Limit Error Alert (> 1 extra guest) */}
                      {analysis && analysis.exceedsMaxLimit && (
                        <Alert
                          type="error"
                          showIcon
                          message={
                            <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                              Số khách ({analysis.totalGuestsPerRoom} người/phòng) vượt quá hạn mức tối đa (Chuẩn {analysis.adultCap} người + tối đa 1 người phát sinh = {analysis.maxAllowedGuestsPerRoom} người/phòng). Vui lòng thêm 1 phòng mới!
                            </span>
                          }
                          style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca' }}
                        />
                      )}

                      {/* Surcharge Alert for exactly 1 extra guest */}
                      {analysis && !analysis.exceedsMaxLimit && analysis.hasExtraGuest && analysis.lineSurchargeTotal > 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          icon={<WarningOutlined style={{ color: '#d97706' }} />}
                          message={
                            <span style={{ fontSize: 12, color: '#92400e' }}>
                              Phát sinh 1 khách ở thêm (vượt chuẩn {analysis.adultCap} người). Đã tính phụ thu: <strong>+{formatPrice(analysis.lineSurchargeTotal)}</strong> ({nights} đêm).
                            </span>
                          }
                          style={{ marginTop: 8, padding: '4px 10px', borderRadius: 6, background: '#fffbeb', border: '1px solid #fde68a' }}
                        />
                      )}

                      {/* Age selectors for children in this room */}
                      {row.children > 0 && (
                        <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                            Độ tuổi từng trẻ em phòng #{index + 1}:
                          </div>
                          <Row gutter={[8, 6]}>
                            {Array.from({ length: row.children }).map((_, childIdx) => (
                              <Col key={childIdx} span={12}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                  <span>Bé {childIdx + 1}:</span>
                                  <Select
                                    size="small"
                                    style={{ flex: 1 }}
                                    value={row.childrenAges[childIdx] ?? 4}
                                    onChange={(val) => handleRowChildAgeChange(row.key, childIdx, val)}
                                  >
                                    <Option value={4}>Dưới 5 tuổi (Miễn phí)</Option>
                                    <Option value={8}>Từ 6 - 11 tuổi (Phụ thu)</Option>
                                    <Option value={12}>Từ 12 tuổi trở lên (Như người lớn)</Option>
                                  </Select>
                                </div>
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>

            {/* Section 3: Xem trước giá */}
            <Card
              size="small"
              title={
                <span style={{ fontSize: 14, fontWeight: 650, color: '#1e293b' }}>
                  <DollarOutlined style={{ marginRight: 6, color: '#3b82f6' }} />
                  3. Tổng tiền & Chi tiết thanh toán
                </span>
              }
              style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}
            >
              <div style={{ background: '#eff6ff', padding: '14px 18px', borderRadius: 8, border: '1px solid #bfdbfe', marginBottom: 14 }}>
                <Row justify="space-between" align="middle" style={{ marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 13, color: '#1e40af' }}>Tổng số phòng & Khách: </span>
                    <strong>{totalRoomsCount} phòng ({totalAdults} NL {totalChildren > 0 ? `+ ${totalChildren} TE` : ''}) · {nights} đêm</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 13, color: '#1e40af' }}>Tiền phòng gốc (ngày thường): </span>
                    <strong>{formatPrice(baseRoomPrice)}</strong>
                  </div>
                </Row>

                {totalHolidaySurcharge > 0 && (
                  <div style={{ padding: '6px 0', borderTop: '1px dashed #93c5fd', marginTop: 6 }}>
                    <Row justify="space-between" align="middle">
                      <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
                        🔴 Phụ thu ngày lễ:
                      </div>
                      <div style={{ color: '#dc2626', fontSize: 14, fontWeight: 700 }}>
                        +{formatPrice(totalHolidaySurcharge)}
                      </div>
                    </Row>
                    <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                      Chi tiết: {holidayDetailsList.map(([name]) => name).join('; ')}
                    </div>
                  </div>
                )}

                {totalWeekendSurcharge > 0 && (
                  <div style={{ padding: '6px 0', borderTop: '1px dashed #93c5fd', marginTop: 6 }}>
                    <Row justify="space-between" align="middle">
                      <div style={{ color: '#d97706', fontSize: 13, fontWeight: 600 }}>
                        🟡 Phụ thu cuối tuần:
                      </div>
                      <div style={{ color: '#d97706', fontSize: 14, fontWeight: 700 }}>
                        +{formatPrice(totalWeekendSurcharge)}
                      </div>
                    </Row>
                    <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                      Chi tiết: {weekendDetailsList.map(([name]) => name).join('; ')}
                    </div>
                  </div>
                )}

                {totalExtraGuestSurcharge > 0 && (
                  <Row justify="space-between" align="middle" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #93c5fd' }}>
                    <div style={{ color: '#d97706', fontSize: 13, fontWeight: 600 }}>
                      <WarningOutlined style={{ marginRight: 4 }} /> Phụ thu khách phát sinh:
                    </div>
                    <div style={{ color: '#d97706', fontSize: 14, fontWeight: 700 }}>
                      +{formatPrice(totalExtraGuestSurcharge)}
                    </div>
                  </Row>
                )}

                <Row justify="space-between" align="middle" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>
                    TỔNG TIỀN ĐƠN ĐẶT PHÒNG:
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#1d4ed8' }}>
                    {formatPrice(totalPrice)}
                  </div>
                </Row>
              </div>

              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item name="notes" label="Ghi chú đơn hàng (nếu có)">
                    <Input placeholder="Nhập ghi chú cho đơn này..." />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Section 4: Phương thức & Thu tiền tại quầy */}
            <Card
              size="small"
              title={
                <span style={{ fontSize: 14, fontWeight: 650, color: '#1e293b' }}>
                  <WalletOutlined style={{ marginRight: 6, color: '#3b82f6' }} />
                  4. Phương thức thanh toán & Thu tiền tại quầy
                </span>
              }
              style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
            >
              {/* Radio options for payment methods */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
                  Chọn hình thức thanh toán:
                </div>
                <Radio.Group
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Row gutter={[12, 12]}>
                    <Col span={8}>
                      <Radio.Button
                        value="cash"
                        style={{
                          width: '100%',
                          height: 52,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          fontWeight: 600
                        }}
                      >
                        <DollarOutlined style={{ color: '#16a34a', marginRight: 8, fontSize: 16 }} />
                        Tiền mặt tại quầy
                      </Radio.Button>
                    </Col>
                    <Col span={8}>
                      <Radio.Button
                        value="vnpay"
                        style={{
                          width: '100%',
                          height: 52,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          fontWeight: 600
                        }}
                      >
                        <img src={vnpayLogo} alt="VNPay" style={{ height: 22, marginRight: 8 }} />
                        Quét mã VNPay
                      </Radio.Button>
                    </Col>
                    <Col span={8}>
                      <Radio.Button
                        value="zalopay"
                        style={{
                          width: '100%',
                          height: 52,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          fontWeight: 600
                        }}
                      >
                        <img src={zalopayLogo} alt="ZaloPay" style={{ height: 22, marginRight: 8 }} />
                        Quét mã ZaloPay
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button
                        value="bank_transfer"
                        style={{
                          width: '100%',
                          height: 48,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          fontWeight: 600
                        }}
                      >
                        <BankOutlined style={{ color: '#2563eb', marginRight: 8, fontSize: 16 }} />
                        Chuyển khoản VietQR
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button
                        value="unpaid"
                        style={{
                          width: '100%',
                          height: 48,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          fontWeight: 600,
                          color: '#64748b'
                        }}
                      >
                        <ClockCircleOutlined style={{ marginRight: 8 }} />
                        Chưa thanh toán (Trả sau)
                      </Radio.Button>
                    </Col>
                  </Row>
                </Radio.Group>
              </div>

              {/* Payment Tier (Full vs Deposit) - shown if not unpaid */}
              {paymentMethod !== 'unpaid' && (
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                  <Row gutter={16} align="middle">
                    <Col span={12}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        Mức thu tiền:
                      </div>
                      <Radio.Group
                        value={paymentTier}
                        onChange={(e) => setPaymentTier(e.target.value)}
                        optionType="button"
                        buttonStyle="solid"
                      >
                        <Radio.Button value="full">Thu 100% ({formatPrice(totalPrice)})</Radio.Button>
                        <Radio.Button value="deposit">Thu cọc 30% ({formatPrice(requiredDepositAmount)})</Radio.Button>
                      </Radio.Group>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {paymentTier === 'deposit'
                          ? `Hệ thống sẽ ghi nhận cọc 30% (${formatPrice(requiredDepositAmount)}), số tiền còn lại ${formatPrice(totalPrice - requiredDepositAmount)} thanh toán khi trả phòng.`
                          : `Thu toàn bộ 100% tiền đơn đặt phòng (${formatPrice(totalPrice)}).`}
                      </div>
                    </Col>
                  </Row>
                </div>
              )}

              {/* Cash payment note */}
              {paymentMethod === 'cash' && (
                <Alert
                  type="success"
                  showIcon
                  icon={<DollarOutlined style={{ color: '#16a34a' }} />}
                  message={
                    <span style={{ fontSize: 13 }}>
                      Thu tiền mặt trực tiếp tại quầy số tiền <strong>{formatPrice(payableAmount)}</strong> khi tạo đơn.
                    </span>
                  }
                  style={{ marginBottom: 14, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                />
              )}

              {/* Online Gateway Info note */}
              {(paymentMethod === 'zalopay' || paymentMethod === 'vnpay') && (
                <Alert
                  type="info"
                  showIcon
                  icon={<QrcodeOutlined style={{ color: '#0284c7' }} />}
                  message={
                    <span style={{ fontSize: 13 }}>
                      Khi nhấn <strong>Tạo đơn</strong>, hệ thống sẽ mở ngay mã QR {paymentMethod === 'zalopay' ? 'ZaloPay' : 'VNPay'} như bên trang thanh toán trực tuyến để khách quét mã với số tiền <strong>{formatPrice(payableAmount)}</strong>.
                    </span>
                  }
                  style={{ marginBottom: 14, borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd' }}
                />
              )}

              {/* Option to Auto Check-in immediately if Check-in is today */}
              {isCheckInToday && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <Checkbox
                    checked={autoCheckIn}
                    onChange={(e) => setAutoCheckIn(e.target.checked)}
                  >
                    <span style={{ fontWeight: 600, color: '#92400e', fontSize: 13 }}>
                      🏨 Nhận phòng (Check-in) ngay cho khách bây giờ
                    </span>
                  </Checkbox>
                  <div style={{ fontSize: 11, color: '#b45309', marginLeft: 24, marginTop: 2 }}>
                    Khách đến nhận phòng trực tiếp trong ngày hôm nay. Trạng thái phòng sẽ được chuyển ngay sang Đang ở (Occupied).
                  </div>
                </div>
              )}
            </Card>
          </Form>
        </Spin>
      </Modal>

      {/* Gateway QR / VietQR Modal (Standardized with Client UX) */}
      <Modal
        open={qrModalVisible}
        onCancel={() => {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          setQrModalVisible(false);
          onSuccess();
          onClose();
        }}
        footer={null}
        width={860}
        className="qr-pay-modal"
        destroyOnHidden
        centered
      >
        {paymentSuccessDone ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 20 }}>
            <CheckCircleFilled style={{ fontSize: 68, color: '#16a34a', marginBottom: 16 }} />
            <h2 style={{ color: '#166534', fontSize: 24, margin: '0 0 8px' }}>Thanh toán thành công!</h2>
            <p style={{ color: '#64748b', fontSize: 15, margin: 0 }}>
              Đơn đặt phòng #{qrModalData?.bookingId} đã được ghi nhận thanh toán hoàn tất ({formatPrice(qrModalData?.amount || 0)}).
            </p>
          </div>
        ) : (
          <div className="qr-pay">
            {/* Cột trái: Khung QR Code chuẩn client */}
            <div className="qr-pay-left">
              <div className="qr-pay-brand">
                {qrModalData?.method === 'zalopay' ? (
                  <img className="qr-brand-logo" src={zalopayLogo} alt="ZaloPay" />
                ) : qrModalData?.method === 'vnpay' ? (
                  <img className="qr-brand-logo" src={vnpayLogo} alt="VNPay" />
                ) : (
                  <img className="qr-brand-logo" src={vietqrLogo} alt="VietQR" />
                )}
                <div>
                  <strong style={{ fontSize: 17, color: '#fff' }}>
                    {qrModalData?.method === 'zalopay'
                      ? 'ZaloPay Sandbox'
                      : qrModalData?.method === 'vnpay'
                      ? 'VNPay Sandbox'
                      : 'Chuyển khoản VietQR'}
                  </strong>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                    {qrModalData?.method === 'bank_transfer'
                      ? 'Quét bằng app ngân hàng bất kỳ qua Napas 247'
                      : 'Quét mã bằng ứng dụng tương ứng để thanh toán'}
                  </span>
                </div>
              </div>

              {renderGatewayQrCode()}

              <div className="qr-timer" style={{ color: '#fff', fontSize: 13 }}>
                <ClockCircleOutlined style={{ marginRight: 6, color: '#f59e0b' }} />
                Mã hết hạn sau: <strong style={{ color: '#fef08a', fontSize: 15 }}>{formatCountdown(qrCountdown)}</strong>
              </div>
            </div>

            {/* Cột phải: Thông tin giao dịch & Thao tác */}
            <div className="qr-pay-right" style={{ padding: '24px 28px', background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#0f172a' }}>
                  Thông tin thanh toán tại quầy
                </h3>

                <div className="qr-info-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>Khách hàng:</span>
                    <strong style={{ color: '#1e293b' }}>{qrModalData?.guestName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>Mã đặt phòng:</span>
                    <strong style={{ color: '#2563eb' }}>#{qrModalData?.bookingId}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>Phòng đặt:</span>
                    <span style={{ color: '#334155', fontWeight: 500 }}>{qrModalData?.roomTypeName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>Thời gian:</span>
                    <span style={{ color: '#334155' }}>{qrModalData?.checkIn} ➔ {qrModalData?.checkOut}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>Mã giao dịch:</span>
                    <Space>
                      <span style={{ color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>{qrModalData?.orderId}</span>
                      <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyText(qrModalData?.orderId || '', 'Mã giao dịch')} />
                    </Space>
                  </div>

                  {qrModalData?.method === 'bank_transfer' && bankSettings && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                        <span style={{ color: '#64748b' }}>Ngân hàng:</span>
                        <strong>{findBankByBin(bankSettings.bankBin)?.name || bankSettings.bankName}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                        <span style={{ color: '#64748b' }}>Số tài khoản:</span>
                        <Space>
                          <strong style={{ color: '#2563eb' }}>{bankSettings.accountNumber}</strong>
                          <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyText(bankSettings.accountNumber, 'Số tài khoản')} />
                        </Space>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                        <span style={{ color: '#64748b' }}>Chủ tài khoản:</span>
                        <strong>{bankSettings.accountName}</strong>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#eff6ff', borderRadius: 8, marginTop: 4 }}>
                    <span style={{ color: '#1e40af', fontWeight: 600 }}>Số tiền cần thanh toán:</span>
                    <strong style={{ color: '#1d4ed8', fontSize: 20 }}>{formatPrice(qrModalData?.amount || 0)}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0369a1', background: '#f0f9ff', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
                  <SyncOutlined spin style={{ color: '#2563eb' }} />
                  <span>Hệ thống đang tự động kiểm tra giao dịch của khách hàng...</span>
                </div>
              </div>

              <div>
                <Row gutter={[10, 10]}>
                  {qrModalData?.paymentUrl && (
                    <Col span={24}>
                      <Button
                        type="primary"
                        block
                        icon={<ArrowRightOutlined />}
                        style={{ height: 42, backgroundColor: qrModalData.method === 'zalopay' ? '#0284c7' : '#0284c7' }}
                        onClick={() => {
                          window.open(qrModalData.paymentUrl, '_blank');
                        }}
                      >
                        Mở màn hình thanh toán Sandbox ({qrModalData.method === 'zalopay' ? 'ZaloPay' : 'VNPay'})
                      </Button>
                    </Col>
                  )}

                  <Col span={12}>
                    <Button
                      block
                      onClick={() => {
                        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                        setQrModalVisible(false);
                        onSuccess();
                        onClose();
                      }}
                      style={{ height: 40 }}
                    >
                      Đóng cửa sổ
                    </Button>
                  </Col>

                  <Col span={12}>
                    <Button
                      type="primary"
                      block
                      icon={<CheckCircleOutlined />}
                      loading={submitting}
                      onClick={handleManualConfirmGatewayPayment}
                      style={{ height: 40, backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                    >
                      Xác nhận đã thu
                    </Button>
                  </Col>
                </Row>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
