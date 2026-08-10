import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { DatePicker, Input, InputNumber, Select, message } from 'antd';
import {ArrowRightOutlined,CalendarOutlined,HistoryOutlined,MailOutlined,PhoneOutlined,UserOutlined,} from '@ant-design/icons';
import dayjs from 'dayjs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBed, faCheck, faExpandArrowsAlt } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../contexts/AuthContext';
import { checkAvailability, checkTypeAvailability, createBooking, getBookings } from '../../services/bookingService';
import { getRoomById, getRoomTypes, getRoomTypeDetail } from '../../services/roomService';
import type { RoomTypeSearchResult } from '../../services/roomService';
import { getServices } from '../../services/serviceService';
import type { Service } from '../../types/service';
import { unwrapList } from '../../utils/unwrapList';
import { getRoomTypeCardImage, handleRoomImageError } from '../../utils/roomTypeImages';
import './Booking.css';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

interface BookingFormData {
  roomId: number;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  adults: number;
  children: number;
  specialRequests: string;
}

interface SelectedRoom {
  // mode 'type': khách đặt theo hạng phòng, hệ thống tự xếp phòng (luồng chính).
  // mode 'room': đặt đích danh một phòng (luồng cũ ?id=, dành cho lễ tân/link cũ).
  mode: 'type' | 'room';
  id: number | null;
  roomTypeId: number;
  name: string;
  image: string;
  price: number;
  beds: string;
  area: string;
  capacity: number;
  status: string;
  roomNumber?: string;
  availableRooms?: number;
}

interface BookingHistoryItem {
  id: number;
  room_number?: string;
  room_type_name?: string;
  check_in: string;
  check_out: string;
  total_price: number | string;
  status: string;
}

interface DateAvailability {
  available: boolean;
  availableRooms?: number;
  conflictingBookingIds?: number[];
  nights?: number;
  nightlyPrices?: { date: string; price: number }[];
  stayAmount?: number;
  childSurcharge?: {
    chargeableChildren: number;
    adultsFromChildren: number;
    surchargePerNight: number;
    amount: number;
  };
  childrenPolicy?: {
    freeMaxAge: number;
    childMaxAge: number;
    surchargePerNight: number;
  };
  totalAmount?: number;
}

interface RoomTypeOption {
  id: number;
  typeName?: string;
  room_type_name?: string;
  defaultPrice?: number | string;
  price_per_night?: number | string;
  capacity?: number | string;
}

interface MultiRoomRequest {
  roomTypeId: number;
  quantity: number;
}

interface TypeAvailabilityRequested {
  roomTypeId: number;
  roomTypeName: string;
  requestedQuantity: number;
  availableRooms: number;
  canBookQuantity: number;
  shortage: number;
  enough: boolean;
}

interface TypeAvailabilitySuggestion {
  roomTypeId: number;
  roomTypeName: string;
  availableRooms: number;
  pricePerNight: number;
  capacity: number;
}

interface TypeAvailabilityResult {
  available: boolean;
  message: string;
  requested: TypeAvailabilityRequested[];
  suggestions: TypeAvailabilitySuggestion[];
}

const bookingStatusMap: Record<string, { label: string; className: string }> = {
  pending: { label: 'Chờ xác nhận', className: 'pending' },
  confirmed: { label: 'Đã xác nhận', className: 'confirmed' },
  checked_in: { label: 'Đang ở', className: 'checked-in' },
  checked_out: { label: 'Đã trả phòng', className: 'checked-out' },
  cancelled: { label: 'Đã hủy', className: 'cancelled' },
};

const roomStatusMap: Record<string, { label: string; className: string }> = {
  available: { label: 'Còn trống', className: 'available' },
  occupied: { label: 'Đang có khách', className: 'occupied' },
  maintenance: { label: 'Đang bảo trì', className: 'maintenance' },
};

const Booking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [submitting, setSubmitting] = useState(false);
  const [recentBookings, setRecentBookings] = useState<BookingHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateAvailability, setDateAvailability] = useState<DateAvailability | null>(null);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [multiRooms, setMultiRooms] = useState<MultiRoomRequest[]>([
    { roomTypeId: 0, quantity: 1 },
  ]);
  const [typeAvailability, setTypeAvailability] = useState<TypeAvailabilityResult | null>(null);
  const [typeAvailabilityChecking, setTypeAvailabilityChecking] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceRequests, setServiceRequests] = useState<{ serviceId: number; quantity: number }[]>([]);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<BookingFormData>({
    defaultValues: {
      roomId: 0,
      guestName: user?.fullName || user?.email?.split('@')[0] || '',
      guestEmail: user?.email || '',
      guestPhone: user?.phone || '',
      adults: 2,
      children: 0,
      specialRequests: ''
    }
  });

  const adults = watch('adults');
  const children = watch('children');

  // Đồng bộ danh sách tuổi trẻ em theo số lượng đã chọn (mặc định 5 tuổi - miễn phí)
  useEffect(() => {
    setChildrenAges((prev) => {
      if (children === prev.length) return prev;
      if (children < prev.length) return prev.slice(0, children);
      return [...prev, ...Array(children - prev.length).fill(5)];
    });
  }, [children]);

  useEffect(() => {
    if (user) {
      setValue('guestName', user.fullName || user.email?.split('@')[0] || '');
      setValue('guestEmail', user.email || '');
      setValue('guestPhone', user.phone || '');
    }
  }, [user, setValue]);

  useEffect(() => {
    const loadRoomTypes = async () => {
      try {
        const response = await getRoomTypes();
        setRoomTypes(unwrapList<RoomTypeOption>(response));
      } catch {
        setRoomTypes([]);
      }
    };

    loadRoomTypes();
  }, []);

  useEffect(() => {
    const loadServices = async () => {
      try {
        setServices(await getServices());
      } catch {
        setServices([]);
      }
    };

    loadServices();
  }, []);

  const handleServiceSelectChange = (ids: number[]) => {
    setServiceRequests((prev) =>
      ids.map((id) => prev.find((s) => s.serviceId === id) || { serviceId: id, quantity: 1 })
    );
  };

  const updateServiceQuantity = (serviceId: number, quantity: number | null) => {
    setServiceRequests((prev) =>
      prev.map((s) => (s.serviceId === serviceId ? { ...s, quantity: quantity || 1 } : s))
    );
  };

  useEffect(() => {
    const loadRecentBookings = async () => {
      if (!isAuthenticated || !user?.id) {
        setRecentBookings([]);
        return;
      }

      setHistoryLoading(true);
      try {
        const response = await getBookings({ userId: user.id });
        setRecentBookings(unwrapList<BookingHistoryItem>(response).slice(0, 3));
      } catch {
        setRecentBookings([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadRecentBookings();
  }, [isAuthenticated, user?.id]);

  // Prefill ngày + số khách từ query string (trang tìm kiếm/chi tiết truyền sang)
  useEffect(() => {
    const paramCheckIn = searchParams.get('checkIn');
    const paramCheckOut = searchParams.get('checkOut');
    if (
      paramCheckIn &&
      paramCheckOut &&
      dayjs(paramCheckIn, 'YYYY-MM-DD', true).isValid() &&
      dayjs(paramCheckOut, 'YYYY-MM-DD', true).isValid() &&
      dayjs(paramCheckOut).isAfter(dayjs(paramCheckIn)) &&
      !dayjs(paramCheckIn).isBefore(dayjs().startOf('day'))
    ) {
      setDateRange([dayjs(paramCheckIn), dayjs(paramCheckOut)]);
      setValue('checkIn', paramCheckIn);
      setValue('checkOut', paramCheckOut);
    }

    const paramAdults = parseInt(searchParams.get('adults') || '', 10);
    if (paramAdults >= 1) setValue('adults', Math.min(paramAdults, 4));
    const paramChildren = parseInt(searchParams.get('children') || '', 10);
    if (paramChildren >= 0) setValue('children', Math.min(paramChildren, 3));

    const paramAges = (searchParams.get('childAges') || '')
      .split(',')
      .map((age) => parseInt(age, 10))
      .filter((age) => Number.isInteger(age) && age >= 0 && age <= 17);
    if (paramAges.length > 0) setChildrenAges(paramAges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setValue]);

  useEffect(() => {
    const roomTypeIdParam = searchParams.get('type');
    const roomId = searchParams.get('id');
    const paramCheckIn = searchParams.get('checkIn') || undefined;
    const paramCheckOut = searchParams.get('checkOut') || undefined;

    // Luồng chính: đặt theo HẠNG PHÒNG - hệ thống tự xếp phòng khi đặt thành công
    const loadRoomType = async (parsedTypeId: number) => {
      try {
        const response = await getRoomTypeDetail(parsedTypeId, {
          checkIn: paramCheckIn,
          checkOut: paramCheckOut,
        });
        let detail = response as unknown as Record<string, unknown>;
        while (detail && typeof detail === 'object' && 'data' in detail) {
          detail = detail.data as Record<string, unknown>;
        }
        const roomType = detail as unknown as RoomTypeSearchResult;
        setSelectedRoom({
          mode: 'type',
          id: null,
          roomTypeId: roomType.id,
          name: roomType.typeName,
          image: getRoomTypeCardImage(roomType.typeName, roomType.images),
          price: Number(roomType.defaultPrice),
          beds: `${roomType.capacity} khách`,
          area:
            roomType.minArea !== null
              ? roomType.minArea === roomType.maxArea
                ? `${roomType.minArea}m²`
                : `${roomType.minArea}–${roomType.maxArea}m²`
              : 'Đang cập nhật',
          capacity: Number(roomType.capacity),
          status: 'available',
          availableRooms: roomType.availableRooms,
        });
        setMultiRooms([{ roomTypeId: roomType.id, quantity: 1 }]);
      } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { message?: string } } };
        if (err.response?.status === 404) {
          message.error('Không tìm thấy hạng phòng này');
        } else {
          message.error(err.response?.data?.message || 'Không thể tải thông tin hạng phòng. Vui lòng thử lại sau.');
        }
        navigate('/rooms');
      }
    };

    // Luồng cũ (?id=): đặt đích danh một phòng - giữ cho link cũ và nghiệp vụ lễ tân
    const loadRoom = async (parsedId: number) => {
      try {
        const response = await getRoomById(parsedId);
        const room = response.data as {
          id: number;
          roomTypeId: number;
          room_type_name: string;
          price_per_night: number;
          capacity: number;
          area?: number;
          room_number?: string;
          roomNumber?: string;
          status?: string;
        };
        setSelectedRoom({
          mode: 'room',
          id: room.id,
          roomTypeId: Number(room.roomTypeId),
          name: room.room_type_name,
          image: getRoomTypeCardImage(room.room_type_name),
          price: Number(room.price_per_night),
          beds: `${room.capacity} khách`,
          area: room.area ? `${room.area}m²` : `Phòng ${room.room_number || room.id}`,
          capacity: room.capacity,
          status: room.status || 'available',
          roomNumber: room.room_number || room.roomNumber,
        });
        setMultiRooms([{ roomTypeId: Number(room.roomTypeId), quantity: 1 }]);
      } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { message?: string } } };
        if (err.response?.status === 404) {
          message.error('Không tìm thấy phòng này');
        } else {
          message.error(err.response?.data?.message || 'Không thể tải thông tin phòng. Vui lòng thử lại sau.');
        }
        navigate('/rooms');
      }
    };

    if (roomTypeIdParam) {
      const parsedTypeId = parseInt(roomTypeIdParam, 10);
      if (Number.isNaN(parsedTypeId) || parsedTypeId <= 0) {
        message.error('Hạng phòng không hợp lệ');
        navigate('/rooms');
      } else {
        loadRoomType(parsedTypeId);
      }
    } else if (roomId) {
      const parsedId = parseInt(roomId, 10);
      if (Number.isNaN(parsedId) || parsedId <= 0) {
        message.error('Mã phòng không hợp lệ');
        navigate('/rooms');
      } else {
        loadRoom(parsedId);
      }
    }

    window.scrollTo(0, 0);
  }, [searchParams, setValue, navigate]);

  const calculateNights = () => {
    if (!dateRange[0] || !dateRange[1]) return 0;
    return dateRange[1].diff(dateRange[0], 'day');
  };

  const nights = calculateNights();
  const isRoomDateUnavailable = dateAvailability?.available === false;
  const isRoomBlockedByStatus = selectedRoom?.status === 'maintenance';
  const canSubmitBooking =
    Boolean(selectedRoom) &&
    !isRoomBlockedByStatus &&
    !isRoomDateUnavailable &&
    nights > 0 &&
    !submitting &&
    !availabilityChecking;

  const serviceAmount = serviceRequests.reduce((total, request) => {
    const service = services.find((item) => item.id === request.serviceId);
    return total + Number(service?.price || 0) * request.quantity;
  }, 0);

  const summaryRooms = multiRooms
    .filter((item) => item.roomTypeId > 0 && item.quantity > 0)
    .map((item) => {
      const type = roomTypes.find((roomType) => Number(roomType.id) === Number(item.roomTypeId));
      return {
        id: item.roomTypeId,
        name: type?.typeName || type?.room_type_name || selectedRoom?.name || `Loại phòng #${item.roomTypeId}`,
        quantity: item.quantity,
        capacity: Number(type?.capacity || selectedRoom?.capacity || 0),
        price: Number(type?.defaultPrice || type?.price_per_night || selectedRoom?.price || 0),
      };
    });
  const totalRoomQuantity = summaryRooms.reduce((sum, room) => sum + room.quantity, 0) || (selectedRoom ? 1 : 0);
  const totalCapacity = summaryRooms.reduce((sum, room) => sum + room.capacity * room.quantity, 0) || Number(selectedRoom?.capacity || 0);
  const estimatedRoomAmount = summaryRooms.reduce((sum, room) => sum + room.price * room.quantity * nights, 0);
  const roomAmount = summaryRooms.length === 1 && summaryRooms[0].id === selectedRoom?.roomTypeId
    ? (dateAvailability?.stayAmount ?? estimatedRoomAmount)
    : estimatedRoomAmount;
  const childSurcharge = Number(dateAvailability?.childSurcharge?.amount || 0);
  const subtotal = roomAmount + childSurcharge + serviceAmount;
  const bookingTotal = subtotal;
  const depositAmount = Math.round(bookingTotal * 0.3);
  const remainingAmount = bookingTotal - depositAmount;

  const getServiceUsageRule = (service: Service) => {
    const name = service.serviceName.toLocaleLowerCase('vi');
    if (name.includes('breakfast') || name.includes('ăn sáng')) return 'Sử dụng 06:30–10:00 mỗi ngày lưu trú.';
    if (name.includes('dinner') || name.includes('tối')) return 'Sử dụng 18:00–21:30; đăng ký trước 16:00.';
    if (name.includes('spa') || name.includes('massage')) return 'Sử dụng 09:00–22:00; đặt lịch trước ít nhất 2 giờ.';
    if (name.includes('airport') || name.includes('đưa đón')) return 'Cung cấp giờ bay trước ít nhất 24 giờ.';
    if (name.includes('laundry') || name.includes('giặt') || name.includes('sấy')) return 'Nhận đồ trước 10:00, hoàn trả trong ngày hoặc theo mô tả.';
    if (name.includes('extra bed') || name.includes('giường')) return 'Tối đa 1 giường phụ/phòng; đăng ký trước 18:00 ngày nhận phòng.';
    if (name.includes('bicycle') || name.includes('xe đạp')) return 'Sử dụng 06:00–20:00, trả xe trong ngày.';
    return 'Sử dụng trong thời gian lưu trú; vui lòng liên hệ lễ tân để hẹn giờ.';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN').format(price) + '₫';
  };

  const formatMoney = (price: number | string) => {
    return new Intl.NumberFormat('vi-VN').format(Number(price || 0)) + 'đ';
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return dayjs(date).format('DD/MM/YYYY');
  };

  const getRoomTypeName = (roomTypeId: number) => {
    const roomType = roomTypes.find((item) => Number(item.id) === Number(roomTypeId));
    return roomType?.typeName || roomType?.room_type_name || `Loại phòng #${roomTypeId}`;
  };

  const updateMultiRoom = (index: number, patch: Partial<MultiRoomRequest>) => {
    setMultiRooms((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      )
    );
    setTypeAvailability(null);
  };

  const addMultiRoom = () => {
    setMultiRooms((items) => [...items, { roomTypeId: 0, quantity: 1 }]);
    setTypeAvailability(null);
  };

  const removeMultiRoom = (index: number) => {
    setMultiRooms((items) => items.filter((_, itemIndex) => itemIndex !== index));
    setTypeAvailability(null);
  };

  const handleCheckTypeAvailability = async () => {
    if (!dateRange[0] || !dateRange[1]) {
      message.warning('Vui lòng chọn ngày nhận và trả phòng trước');
      return;
    }

    const rooms = multiRooms
      .filter((item) => item.roomTypeId > 0 && item.quantity > 0)
      .map((item) => ({
        roomTypeId: item.roomTypeId,
        quantity: item.quantity,
      }));

    if (rooms.length === 0) {
      message.warning('Vui lòng chọn ít nhất một hạng phòng cần kiểm tra');
      return;
    }

    setTypeAvailabilityChecking(true);
    try {
      const response = await checkTypeAvailability({
        checkIn: dateRange[0].format('YYYY-MM-DD'),
        checkOut: dateRange[1].format('YYYY-MM-DD'),
        rooms,
      });
      setTypeAvailability(response.data as TypeAvailabilityResult);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Không thể kiểm tra số lượng phòng lúc này');
      setTypeAvailability(null);
    } finally {
      setTypeAvailabilityChecking(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const verifyDateAvailability = async () => {
      if (!selectedRoom || selectedRoom.status === 'maintenance' || !dateRange[0] || !dateRange[1]) {
        setDateAvailability(null);
        return;
      }

      setAvailabilityChecking(true);
      try {
        const response = await checkAvailability({
          ...(selectedRoom.mode === 'type'
            ? { roomTypeId: selectedRoom.roomTypeId }
            : { roomId: selectedRoom.id }),
          checkIn: dateRange[0].format('YYYY-MM-DD'),
          checkOut: dateRange[1].format('YYYY-MM-DD'),
          childrenAges,
        });

        if (!cancelled) {
          setDateAvailability(response.data as DateAvailability);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const err = error as { response?: { status?: number; data?: { details?: { conflictingBookingIds?: number[] } } } };
          if (err.response?.status === 409) {
            setDateAvailability({
              available: false,
              conflictingBookingIds: err.response.data?.details?.conflictingBookingIds || [],
            });
          } else {
            setDateAvailability(null);
          }
        }
      } finally {
        if (!cancelled) {
          setAvailabilityChecking(false);
        }
      }
    };

    verifyDateAvailability();

    return () => {
      cancelled = true;
    };
  }, [selectedRoom, dateRange, childrenAges]);

  const onSubmit = async (data: BookingFormData) => {
    if (!isAuthenticated || !user?.id) {
      message.warning('Vui lòng đăng nhập để đặt phòng');
      navigate('/login');
      return;
    }

    if (!selectedRoom) {
      message.error('Vui lòng chọn phòng trước khi đặt');
      return;
    }

    if (selectedRoom.status === 'maintenance') {
      const statusLabel = roomStatusMap[selectedRoom.status]?.label || 'không còn trống';
      message.error(`Phòng này hiện ${statusLabel.toLowerCase()}, vui lòng chọn phòng khác`);
      return;
    }

    if (!dateRange[0] || !dateRange[1]) {
      message.error('Vui lòng chọn ngày nhận và trả phòng');
      return;
    }

    if (isRoomDateUnavailable) {
      message.error('Phòng đã có người đặt trong khoảng thời gian này, vui lòng chọn ngày khác');
      return;
    }

    const checkIn = dateRange[0].format('YYYY-MM-DD');
    const checkOut = dateRange[1].format('YYYY-MM-DD');
    // Đặt theo hạng phòng: backend tự xếp phòng trống; đặt theo phòng: giữ nguyên roomId
    const roomSelector =
      selectedRoom.mode === 'type'
        ? { roomTypeId: selectedRoom.roomTypeId }
        : { roomId: selectedRoom.id };

    const childMaxAge = dateAvailability?.childrenPolicy?.childMaxAge ?? 12;
    const adultsFromChildren = childrenAges.filter((age) => age > childMaxAge).length;
    if (data.adults + adultsFromChildren > selectedRoom.capacity) {
      message.error(`Số khách vượt quá sức chứa phòng (${selectedRoom.capacity} người)`);
      return;
    }

    setSubmitting(true);
    try {
      const availability = await checkAvailability({
        ...roomSelector,
        checkIn,
        checkOut,
      });

      if (!availability.data.available) {
        message.error('Rất tiếc, hạng phòng vừa hết chỗ trong khoảng ngày đã chọn. Vui lòng chọn ngày hoặc hạng phòng khác.');
        return;
      }

      const bookingRes = await createBooking({
        userId: user.id,
        ...roomSelector,
        checkIn,
        checkOut,
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone,
        adults: data.adults,
        children: data.children,
        childrenAges,
        notes: data.specialRequests || null,
        serviceRequests,
        status: 'confirmed',
      });

      message.success('Đặt phòng thành công! Phòng được giữ tạm 15 phút, vui lòng thanh toán để xác nhận.');
      const newBookingId = (bookingRes as { data?: { id?: number } })?.data?.id;
      navigate(newBookingId ? `/booking/${newBookingId}/payment` : '/booking/history');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const msg = err.response?.data?.message || 'Đặt phòng thất bại';
      const errorMap: Record<string, string> = {
        'roomId must be a positive integer': 'Mã phòng không hợp lệ',
        'roomId is required': 'Vui lòng chọn lại hạng phòng',
        'roomTypeId must be a positive integer': 'Hạng phòng không hợp lệ',
        'userId must be a positive integer': 'Thông tin tài khoản không hợp lệ, vui lòng đăng nhập lại',
        'checkOut must be after checkIn': 'Ngày trả phòng phải sau ngày nhận phòng',
      };
      message.error(errorMap[msg] || msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-page">
      <div className="booking-hero">
        <div className="booking-hero-content">
          <h1>Đặt phòng</h1>
          <p>Hoàn tất thông tin để đặt phòng của bạn</p>
        </div>
      </div>

      <div className="booking-container">
        {isAuthenticated && (
          <section className="booking-history-panel">
            <div className="history-panel-header">
              <div>
                <span className="history-eyebrow">
                  <HistoryOutlined /> Lịch sử của bạn
                </span>
                <h2>Đặt phòng gần đây</h2>
              </div>
              <Link to="/booking/history" className="history-view-all">
                Xem tất cả <ArrowRightOutlined />
              </Link>
            </div>

            {historyLoading ? (
              <div className="history-loading">Đang tải lịch sử đặt phòng...</div>
            ) : recentBookings.length > 0 ? (
              <div className="history-card-grid">
                {recentBookings.map((booking) => {
                  const status = bookingStatusMap[booking.status] || {
                    label: booking.status,
                    className: 'default',
                  };

                  return (
                    <article className="history-card" key={booking.id}>
                      <div className="history-card-top">
                        <span className="history-code">#{booking.id}</span>
                        <span className={`history-status ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <h3>{booking.room_number || 'Phòng'} - {booking.room_type_name || 'Đặt phòng'}</h3>
                      <div className="history-date">
                        <CalendarOutlined />
                        <span>{formatDate(booking.check_in)} - {formatDate(booking.check_out)}</span>
                      </div>
                      <div className="history-card-bottom">
                        <strong>{formatMoney(booking.total_price)}</strong>
                        <Link to={`/booking/${booking.id}`}>Chi tiết</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="history-empty">
                <div>
                  <h3>Chưa có lịch sử đặt phòng</h3>
                  <p>Các đặt phòng mới của bạn sẽ xuất hiện tại đây để dễ theo dõi.</p>
                </div>
                <Link to="/rooms" className="history-empty-action">Khám phá phòng</Link>
              </div>
            )}
          </section>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="booking-form-wrapper">
          <div className="booking-main">
            <div className="booking-section">
              <h2>Thông tin khách hàng</h2>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Họ và tên <span className="required">*</span></label>
                  <Controller
                    name="guestName"
                    control={control}
                    rules={{ required: 'Vui lòng nhập họ tên' }}
                    render={({ field }) => (
                      <Input 
                        {...field}
                        placeholder="Nhập họ và tên của bạn"
                        size="large"
                        prefix={<UserOutlined />}
                      />
                    )}
                  />
                  {errors.guestName && <span className="error-text">{errors.guestName.message}</span>}
                </div>
              </div>

              <div className="form-row two-col">
                <div className="form-group">
                  <label>Email <span className="required">*</span></label>
                  <Controller
                    name="guestEmail"
                    control={control}
                    rules={{ 
                      required: 'Vui lòng nhập email',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Email không hợp lệ'
                      }
                    }}
                    render={({ field }) => (
                      <Input 
                        {...field}
                        placeholder="email@example.com"
                        size="large"
                        prefix={<MailOutlined />}
                      />
                    )}
                  />
                  {errors.guestEmail && <span className="error-text">{errors.guestEmail.message}</span>}
                </div>
                <div className="form-group">
                  <label>Số điện thoại <span className="required">*</span></label>
                  <Controller
                    name="guestPhone"
                    control={control}
                    rules={{ required: 'Vui lòng nhập số điện thoại' }}
                    render={({ field }) => (
                      <Input 
                        {...field}
                        placeholder="0xxx xxx xxx"
                        size="large"
                        prefix={<PhoneOutlined />}
                      />
                    )}
                  />
                  {errors.guestPhone && <span className="error-text">{errors.guestPhone.message}</span>}
                </div>
              </div>
            </div>

            <div className="booking-section">
              <h2>Ngày lưu trú</h2>
              
              <div className="form-group">
                <label>Ngày nhận và trả phòng <span className="required">*</span></label>
                <RangePicker
                  style={{ width: '100%', height: '48px' }}
                  placeholder={['Ngày nhận phòng', 'Ngày trả phòng']}
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                  value={dateRange}
                  onChange={(dates) => {
                    setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null]);
                    setTypeAvailability(null);
                    if (dates) {
                      setValue('checkIn', dates[0]?.format('YYYY-MM-DD') || '');
                      setValue('checkOut', dates[1]?.format('YYYY-MM-DD') || '');
                    }
                  }}
                />
              </div>

              {nights > 0 && (
                <div className="nights-info">
                  <span className="nights-count">Số đêm: <strong>{nights}</strong> đêm</span>
                </div>
              )}

              <div className="multi-room-checker">
                <div className="multi-room-header">
                  <div>
                    <strong>Kiểm tra nhiều hạng phòng</strong>
                    <p>Chọn số lượng theo từng hạng phòng để biết còn đủ phòng hay cần chọn thêm loại khác.</p>
                  </div>
                  <button type="button" className="btn-add-room-type" onClick={addMultiRoom}>
                    Thêm hạng phòng
                  </button>
                </div>

                <div className="multi-room-list">
                  {multiRooms.map((item, index) => (
                    <div className="multi-room-row" key={`${item.roomTypeId}-${index}`}>
                      <Select
                        value={item.roomTypeId || undefined}
                        placeholder="Chọn hạng phòng"
                        onChange={(value) => updateMultiRoom(index, { roomTypeId: Number(value) })}
                        options={roomTypes.map((roomType) => ({
                          value: roomType.id,
                          label: `${roomType.typeName || roomType.room_type_name || `Loại phòng #${roomType.id}`} - ${formatMoney(roomType.defaultPrice || roomType.price_per_night || 0)}/đêm`,
                        }))}
                        size="large"
                        style={{ width: '100%' }}
                      />
                      <InputNumber
                        min={1}
                        max={20}
                        value={item.quantity}
                        onChange={(value) => updateMultiRoom(index, { quantity: Number(value || 1) })}
                        size="large"
                        className="multi-room-quantity"
                      />
                      <button
                        type="button"
                        className="btn-remove-room-type"
                        onClick={() => removeMultiRoom(index)}
                        disabled={multiRooms.length === 1}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-check-room-types"
                  onClick={handleCheckTypeAvailability}
                  disabled={typeAvailabilityChecking || roomTypes.length === 0}
                >
                  {typeAvailabilityChecking ? 'Đang kiểm tra...' : 'Kiểm tra số phòng trống'}
                </button>

                {typeAvailability && (
                  <div className={`multi-room-result ${typeAvailability.available ? 'success' : 'warning'}`}>
                    <strong>
                      {typeAvailability.available
                        ? 'Đủ phòng cho yêu cầu của bạn'
                        : 'Chưa đủ phòng cho toàn bộ yêu cầu'}
                    </strong>
                    <div className="multi-room-result-list">
                      {typeAvailability.requested.map((item) => (
                        <div className="multi-room-result-item" key={item.roomTypeId}>
                          <span>{item.roomTypeName || getRoomTypeName(item.roomTypeId)}</span>
                          <em>
                            Yêu cầu {item.requestedQuantity}, còn {item.availableRooms}
                            {item.shortage > 0
                              ? `, thiếu ${item.shortage}. Có thể đặt tạm ${item.canBookQuantity} phòng.`
                              : ', đủ số lượng.'}
                          </em>
                        </div>
                      ))}
                    </div>

                    {!typeAvailability.available && typeAvailability.suggestions.length > 0 && (
                      <div className="multi-room-suggestions">
                        <span>Gợi ý hạng phòng còn trống:</span>
                        {typeAvailability.suggestions.slice(0, 3).map((item) => (
                          <em key={item.roomTypeId}>
                            {item.roomTypeName}: còn {item.availableRooms} phòng, {formatMoney(item.pricePerNight)}/đêm
                          </em>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="form-row two-col">
                <div className="form-group">
                  <label>Người lớn</label>
                  <Select
                    value={adults}
                    onChange={(value) => setValue('adults', value)}
                    options={[
                      { value: 1, label: '1 người lớn' },
                      { value: 2, label: '2 người lớn' },
                      { value: 3, label: '3 người lớn' },
                      { value: 4, label: '4 người lớn' }
                    ]}
                    size="large"
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="form-group">
                  <label>Trẻ em</label>
                  <Select
                    value={children}
                    onChange={(value) => setValue('children', value)}
                    options={[
                      { value: 0, label: 'Không có trẻ em' },
                      { value: 1, label: '1 trẻ em' },
                      { value: 2, label: '2 trẻ em' },
                      { value: 3, label: '3 trẻ em' }
                    ]}
                    size="large"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {children > 0 && (
                <div className="form-row two-col" style={{ flexWrap: 'wrap' }}>
                  {childrenAges.map((age, index) => (
                    <div className="form-group" key={index}>
                      <label>Tuổi trẻ em {index + 1}</label>
                      <Select
                        value={age}
                        onChange={(value) =>
                          setChildrenAges((prev) => prev.map((item, i) => (i === index ? value : item)))
                        }
                        options={Array.from({ length: 18 }, (_, ageOption) => ({
                          value: ageOption,
                          label: `${ageOption} tuổi`,
                        }))}
                        size="large"
                        style={{ width: '100%' }}
                      />
                    </div>
                  ))}
                  {dateAvailability?.childrenPolicy && (
                    <p className="service-request-note" style={{ width: '100%' }}>
                      * 0–{dateAvailability.childrenPolicy.freeMaxAge} tuổi miễn phí ·{' '}
                      {dateAvailability.childrenPolicy.freeMaxAge + 1}–{dateAvailability.childrenPolicy.childMaxAge}{' '}
                      tuổi phụ thu {formatMoney(dateAvailability.childrenPolicy.surchargePerNight)}/đêm · từ{' '}
                      {dateAvailability.childrenPolicy.childMaxAge + 1} tuổi tính như người lớn
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="booking-section">
              <h2>Yêu cầu đặc biệt</h2>
              <div className="form-group">
                <label>Ghi chú (tùy chọn)</label>
                <Controller
                  name="specialRequests"
                  control={control}
                  render={({ field }) => (
                    <TextArea
                      {...field}
                      placeholder="Nhập các yêu cầu đặc biệt như: giường phụ, thú cưng, dị ứng..."
                      rows={4}
                    />
                  )}
                />
              </div>

              <div className="form-group">
                <label>Dịch vụ của phòng (tùy chọn)</label>
                <Select
                  mode="multiple"
                  size="large"
                  style={{ width: '100%' }}
                  placeholder="Chọn dịch vụ bạn muốn (giường phụ, ăn sáng, spa, đưa đón...)"
                  value={serviceRequests.map((s) => s.serviceId)}
                  onChange={handleServiceSelectChange}
                  optionFilterProp="label"
                  options={services.map((s) => ({
                    value: s.id,
                    label: `${s.serviceName} - ${formatMoney(s.price)}`,
                  }))}
                />

                {serviceRequests.length > 0 && (
                  <div className="service-request-list">
                    {serviceRequests.map((sel) => {
                      const svc = services.find((s) => s.id === sel.serviceId);
                      return (
                        <div className="service-request-row" key={sel.serviceId}>
                          <span className="service-request-name">
                            {svc?.serviceName} <em>({formatMoney(svc?.price ?? 0)})</em>
                            {svc && (
                              <>
                                <small>{svc.description || 'Dịch vụ bổ sung cho phòng.'}</small>
                                <small className="service-usage-rule">{getServiceUsageRule(svc)}</small>
                              </>
                            )}
                          </span>
                          <InputNumber
                            min={1}
                            max={
                              svc && (
                                svc.serviceName.toLocaleLowerCase('vi').includes('extra bed') ||
                                svc.serviceName.toLocaleLowerCase('vi').includes('giường')
                              )
                                ? 1
                                : 20
                            }
                            value={sel.quantity}
                            onChange={(v) => updateServiceQuantity(sel.serviceId, v)}
                            addonBefore="SL"
                          />
                        </div>
                      );
                    })}
                    <p className="service-request-note">
                      * Dịch vụ đã chọn được giữ cùng phòng và cộng ngay vào tổng thanh toán.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="booking-sidebar">
            <div className="booking-summary">
              <h3>Tóm tắt đặt phòng</h3>
              
              {selectedRoom ? (
                <>
                  <div className="selected-room">
                    <img
                      src={selectedRoom.image}
                      alt={selectedRoom.name}
                      onError={(e) => handleRoomImageError(e, selectedRoom.name)}
                    />
                    <div className="room-summary-info">
                      <div className="room-summary-heading">
                        <h4>Phòng {selectedRoom.name}</h4>
                        {selectedRoom.mode === 'room' && (
                          <span className={`room-status-badge ${roomStatusMap[selectedRoom.status]?.className || 'default'}`}>
                            {roomStatusMap[selectedRoom.status]?.label || selectedRoom.status}
                          </span>
                        )}
                      </div>
                      {selectedRoom.mode === 'room' && selectedRoom.roomNumber && (
                        <p className="room-number-line">Phòng {selectedRoom.roomNumber}</p>
                      )}
                      <p><FontAwesomeIcon icon={faBed} /> Tối đa {selectedRoom.beds}</p>
                      <p><FontAwesomeIcon icon={faExpandArrowsAlt} /> {selectedRoom.area}</p>
                    </div>
                  </div>

                  {selectedRoom.mode === 'type' && (
                    <p className="service-request-note" style={{ marginTop: 8 }}>
                      * Số phòng cụ thể sẽ được khách sạn sắp xếp và thông báo khi nhận phòng.
                    </p>
                  )}

                  <div className="summary-details">
                    <div className="summary-group-title">Chi tiết lưu trú</div>
                    {summaryRooms.map((room) => (
                      <div className="summary-room-line" key={room.id}>
                        <span>{room.name} × {room.quantity}</span>
                        <strong>{formatPrice(room.price)}/đêm</strong>
                      </div>
                    ))}
                    <div className="summary-row">
                      <span>Số lượng phòng</span>
                      <span>{totalRoomQuantity} phòng</span>
                    </div>
                    <div className="summary-row">
                      <span>Khách & sức chứa</span>
                      <span>{adults} NL · {children} TE / {totalCapacity || '—'} khách</span>
                    </div>
                    <div className="summary-row">
                      <span>Số đêm</span>
                      <span>{nights > 0 ? `${nights} đêm` : '-'}</span>
                    </div>
                    {nights > 0 && (
                      <>
                        <div className="summary-row">
                          <span>Tiền phòng</span>
                          <span>{formatPrice(roomAmount)}</span>
                        </div>
                        {childSurcharge > 0 && (
                          <div className="summary-row">
                            <span>
                              Phụ thu trẻ em ({dateAvailability?.childSurcharge?.chargeableChildren} bé)
                            </span>
                            <span>{formatPrice(childSurcharge)}</span>
                          </div>
                        )}
                        {serviceAmount > 0 && (
                          <div className="summary-row">
                            <span>Dịch vụ bổ sung</span>
                            <span>{formatPrice(serviceAmount)}</span>
                          </div>
                        )}
                        <div className="summary-row total">
                          <span>Tổng cộng</span>
                          <span className="total-price">
                            {formatPrice(bookingTotal)}
                          </span>
                        </div>
                        <div className="summary-row deposit">
                          <span>Tiền cọc dự kiến (30%)</span>
                          <strong>{formatPrice(depositAmount)}</strong>
                        </div>
                        <div className="summary-row remaining">
                          <span>Còn phải thanh toán</span>
                          <strong>{formatPrice(remainingAmount)}</strong>
                        </div>
                      </>
                    )}
                  </div>

                  {nights > 0 && (
                    <div
                      className={`date-availability-note ${
                        availabilityChecking
                          ? 'checking'
                          : isRoomDateUnavailable
                            ? 'unavailable'
                            : dateAvailability?.available
                              ? 'available'
                              : ''
                      }`}
                    >
                      {availabilityChecking
                        ? 'Đang kiểm tra phòng trống theo ngày đã chọn...'
                        : isRoomDateUnavailable
                          ? selectedRoom.mode === 'type'
                            ? 'Rất tiếc, hạng phòng này đã hết phòng trống trong khoảng ngày bạn chọn. Vui lòng chọn ngày khác hoặc hạng phòng khác.'
                            : 'Rất tiếc, phòng này đã có khách giữ chỗ trong khoảng ngày bạn chọn. Bạn vui lòng chọn ngày khác hoặc tham khảo phòng còn trống nhé.'
                          : dateAvailability?.available
                            ? selectedRoom.mode === 'type' && dateAvailability.availableRooms !== undefined
                              ? `Còn ${dateAvailability.availableRooms} phòng trống trong khoảng ngày đã chọn.`
                              : 'Phòng còn trống trong khoảng ngày đã chọn.'
                            : 'Chọn ngày để kiểm tra phòng trống.'}
                    </div>
                  )}

                  {isRoomBlockedByStatus && (
                    <div className="room-unavailable-note">
                      Phòng này hiện không thể đặt. Vui lòng quay lại danh sách phòng để chọn phòng còn trống.
                    </div>
                  )}

                  <div className="booking-policies">
                    <h4>Chính sách</h4>
                    <ul>
                      <li><FontAwesomeIcon icon={faCheck} /> Hoàn 100% khi hủy trước 7 ngày, 50% trước 3–7 ngày</li>
                      <li><FontAwesomeIcon icon={faCheck} /> Nhận phòng từ 14:00</li>
                      <li><FontAwesomeIcon icon={faCheck} /> Trả phòng trước 12:00</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="no-room-selected">
                  <p>Bạn chưa chọn hạng phòng</p>
                  <Link to="/rooms" className="btn-select-room">
                    Tìm phòng ngay
                  </Link>
                </div>
              )}

              <button 
                type="submit" 
                className="btn-confirm-booking"
                disabled={!canSubmitBooking}
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận đặt phòng'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Booking;
