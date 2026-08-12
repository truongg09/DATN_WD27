import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import {
  DatePicker,
  Input,
  InputNumber,
  Select,
  Space,
  TimePicker,
  message,
  Button,
} from "antd";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../contexts/AuthContext";
import {
  checkAvailability,
  createBooking,
  getBookings,
} from "../../services/bookingService";
import {
  getRoomById,
  getRoomTypes,
  getRoomTypeDetail,
} from "../../services/roomService";
import type { RoomTypeSearchResult } from "../../services/roomService";
import { getServices } from "../../services/serviceService";
import type { Service } from "../../types/service";
import { unwrapList } from "../../utils/unwrapList";
import {
  getRoomTypeCardImage,
  handleRoomImageError,
} from "../../utils/roomTypeImages";
import "./Booking.css";
import { getPolicies } from "../../services/settingsService";
import type { PoliciesInfo } from "../../services/settingsService";

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
  requestedCheckInTime: string | null;
  requestedCheckOutTime: string | null;
}

interface RoomTypeOption {
  id: number;
  typeName: string;
  defaultPrice?: number | string;
  capacity?: number;
  adultCapacity?: number;
  childCapacity?: number;
  maxOccupancy?: number;
  extraAdultFee?: number;
  extraChildFee?: number;
}

interface SelectedRoom {
  mode: "type" | "room";
  id: number | null;
  roomTypeId: number;
  name: string;
  image: string;
  price: number;
  beds: string;
  area: string;
  capacity: number;
  adultCapacity?: number;
  childCapacity?: number;
  maxOccupancy?: number;
  extraAdultFee?: number;
  extraChildFee?: number;
  status: string;
  roomNumber?: string;
  availableRooms?: number;
}

import { renderRoomTypesSummaryText } from "../../utils/bookingUtils";

interface BookingHistoryItem {
  id: number;
  room_number?: string;
  room_type_name?: string;
  room_quantity?: number;
  roomTypesSummary?: Array<{ roomTypeId?: number; typeName: string; quantity: number; roomPrice?: number }>;
  booking_rooms?: Array<{ bookingDetailId?: number; id: number; number: string; roomTypeId?: number; typeName?: string }>;
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

const bookingStatusMap: Record<string, { label: string; className: string }> = {
  pending: { label: "Chờ xác nhận", className: "pending" },
  confirmed: { label: "Đã xác nhận", className: "confirmed" },
  checked_in: { label: "Đang ở", className: "checked-in" },
  checked_out: { label: "Đã trả phòng", className: "checked-out" },
  cancelled: { label: "Đã hủy", className: "cancelled" },
};

const canShowRoomNumber = (status: string | undefined) =>
  status === 'checked_in' || status === 'checked_out';

const Booking: React.FC = () => {
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null]
  >([null, null]);
  const [submitting, setSubmitting] = useState(false);
  const [recentBookings, setRecentBookings] = useState<BookingHistoryItem[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateAvailability, setDateAvailability] =
    useState<DateAvailability | null>(null);
  const [availabilityChecking, setAvailabilityChecking] = useState(false);
  const [roomQuantity, setRoomQuantity] = useState<number>(1);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceRequests, setServiceRequests] = useState<
    { serviceId: number; quantity: number; roomIndex?: number }[]
  >([]);
  const [childrenAges, setChildrenAges] = useState<(number | null)[]>([]);
  const [policies, setPolicies] = useState<PoliciesInfo | null>(null);
  const [selectedRoomsList, setSelectedRoomsList] = useState<any[]>([]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BookingFormData>({
    defaultValues: {
      roomId: 0,
      guestName: user?.fullName || user?.email?.split("@")[0] || "",
      guestEmail: user?.email || "",
      guestPhone: user?.phone || "",
      adults: 2,
      children: 0,
      specialRequests: "",
      requestedCheckInTime: null,
      requestedCheckOutTime: null,
    },
  });

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

  const adults = watch("adults");
  const children = watch("children");

  // Fix Item 6: Không tự mặc định 5 tuổi cho trẻ mới thêm.
  // Gán -1 (unselected) để ép người dùng phải chọn tuổi thật trước khi đặt phòng.
  useEffect(() => {
    setChildrenAges((prev) => {
      if (children === prev.length) return prev;
      if (children < prev.length) return prev.slice(0, children);
      return [...prev, ...Array(children - prev.length).fill(null)];
    });
  }, [children]);

  useEffect(() => {
    if (user) {
      setValue("guestName", user.fullName || user.email?.split("@")[0] || "");
      setValue("guestEmail", user.email || "");
      setValue("guestPhone", user.phone || "");
    }
  }, [user, setValue]);

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

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const response = await getPolicies();
        setPolicies(response.data);
      } catch {
        setPolicies(null);
      }
    };

    loadPolicies();
  }, []);

  const shortTime = (time?: string) => (time ? time.slice(0, 5) : "");

  const handleServiceSelectChange = (ids: number[]) => {
    setServiceRequests((prev) =>
      ids.map(
        (id) =>
          prev.find((s) => s.serviceId === id) || {
            serviceId: id,
            quantity: 1,
            roomIndex: 1,
          },
      ),
    );
  };

  const updateServiceQuantity = (
    serviceId: number,
    quantity: number | null,
  ) => {
    setServiceRequests((prev) =>
      prev.map((s) =>
        s.serviceId === serviceId ? { ...s, quantity: quantity || 1 } : s,
      ),
    );
  };

  const updateServiceRoomIndex = (
    serviceId: number,
    roomIndex: number,
  ) => {
    setServiceRequests((prev) =>
      prev.map((s) =>
        s.serviceId === serviceId ? { ...s, roomIndex } : s,
      ),
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

  // Prefill ngày + số khách từ query string (Fix Item 2: Bỏ max 4 NL / 3 TE)
  useEffect(() => {
    const paramCheckIn = searchParams.get("checkIn");
    const paramCheckOut = searchParams.get("checkOut");
    if (
      paramCheckIn &&
      paramCheckOut &&
      dayjs(paramCheckIn, "YYYY-MM-DD", true).isValid() &&
      dayjs(paramCheckOut, "YYYY-MM-DD", true).isValid() &&
      dayjs(paramCheckOut).isAfter(dayjs(paramCheckIn)) &&
      !dayjs(paramCheckIn).isBefore(dayjs().startOf("day"))
    ) {
      setDateRange([dayjs(paramCheckIn), dayjs(paramCheckOut)]);
      setValue("checkIn", paramCheckIn);
      setValue("checkOut", paramCheckOut);
    }

    const paramAdults = parseInt(searchParams.get("adults") || "", 10);
    if (paramAdults >= 1) setValue("adults", Math.min(paramAdults, 30));
    const paramChildren = parseInt(searchParams.get("children") || "", 10);
    if (paramChildren >= 0) setValue("children", Math.min(paramChildren, 20));

    const paramQuantity = parseInt(
      searchParams.get("roomQuantity") ||
        searchParams.get("quantity") ||
        searchParams.get("rooms") ||
        "1",
      10,
    );
    if (paramQuantity >= 1) setRoomQuantity(paramQuantity);

    const paramAges = (searchParams.get("childAges") || "")
      .split(",")
      .map((age) => parseInt(age, 10))
      .filter((age) => Number.isInteger(age) && age >= 0 && age <= 17);
    if (paramAges.length > 0) setChildrenAges(paramAges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setValue]);

  useEffect(() => {
    const roomTypeIdParam = searchParams.get("type");
    const roomId = searchParams.get("id");
    const paramCheckIn = searchParams.get("checkIn") || undefined;
    const paramCheckOut = searchParams.get("checkOut") || undefined;

    const loadRoomType = async (parsedTypeId: number) => {
      try {
        const response = await getRoomTypeDetail(parsedTypeId, {
          checkIn: paramCheckIn,
          checkOut: paramCheckOut,
        });
        let detail = response as unknown as Record<string, unknown>;
        while (detail && typeof detail === "object" && "data" in detail) {
          detail = detail.data as Record<string, unknown>;
        }
        const roomType = detail as unknown as RoomTypeSearchResult & {
          adultCapacity?: number;
          childCapacity?: number;
          maxOccupancy?: number;
          extraAdultFee?: number;
          extraChildFee?: number;
        };
        const adultCap = Number(roomType.adultCapacity ?? 2);
        const childCap = Number(roomType.childCapacity ?? 1);
        const maxOcc = Number(
          roomType.maxOccupancy ?? (roomType.capacity || adultCap + childCap),
        );

        setSelectedRoom({
          mode: "type",
          id: null,
          roomTypeId: roomType.id,
          name: roomType.typeName,
          image: getRoomTypeCardImage(roomType.typeName, roomType.images),
          price: Number(roomType.defaultPrice),
          beds: `${adultCap} NL + ${childCap} TE (Tối đa ${maxOcc} khách)`,
          area:
            roomType.minArea !== null
              ? roomType.minArea === roomType.maxArea
                ? `${roomType.minArea}m²`
                : `${roomType.minArea}–${roomType.maxArea}m²`
              : "Đang cập nhật",
          capacity: Number(roomType.capacity),
          adultCapacity: adultCap,
          childCapacity: childCap,
          maxOccupancy: maxOcc,
          extraAdultFee: Number(roomType.extraAdultFee ?? 200000),
          extraChildFee: Number(roomType.extraChildFee ?? 100000),
          status: "available",
          availableRooms: roomType.availableRooms,
        });
      } catch (error: unknown) {
        const err = error as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (err.response?.status === 404) {
          message.error("Không tìm thấy hạng phòng này");
        } else {
          message.error(
            err.response?.data?.message ||
              "Không thể tải thông tin hạng phòng. Vui lòng thử lại sau.",
          );
        }
        navigate("/rooms");
      }
    };

    // Link cũ (?id=): không cho đặt theo phòng cụ thể -> convert sang đặt theo hạng phòng
    const convertRoomIdToType = async (parsedId: number) => {
      try {
        const response = await getRoomById(parsedId);
        const room = response.data as {
          id: number;
          roomTypeId: number;
          room_type_name: string;
          price_per_night: number;
          capacity: number;
          adultCapacity?: number;
          childCapacity?: number;
          maxOccupancy?: number;
          extraAdultFee?: number;
          extraChildFee?: number;
          area?: number;
          room_number?: string;
          roomNumber?: string;
          status?: string;
        };
        const adultCap = Number(room.adultCapacity ?? 2);
        const childCap = Number(room.childCapacity ?? 1);
        const maxOcc = Number(
          room.maxOccupancy ?? (room.capacity || adultCap + childCap),
        );

        setSelectedRoom({
          mode: "room",
          id: room.id,
          roomTypeId: Number(room.roomTypeId),
          name: room.room_type_name,
          image: getRoomTypeCardImage(room.room_type_name),
          price: Number(room.price_per_night),
          beds: `${adultCap} NL + ${childCap} TE (Tối đa ${maxOcc} khách)`,
          area: room.area
            ? `${room.area}m²`
            : `${room.room_type_name || 'Phòng chuẩn'}`,
          capacity: room.capacity,
          adultCapacity: adultCap,
          childCapacity: childCap,
          maxOccupancy: maxOcc,
          extraAdultFee: Number(room.extraAdultFee ?? 200000),
          extraChildFee: Number(room.extraChildFee ?? 100000),
          status: room.status || "available",
          roomNumber: room.room_number || room.roomNumber,
        });
      } catch (error: unknown) {
        const err = error as {
          response?: { status?: number; data?: { message?: string } };
        };
        if (err.response?.status === 404) {
          message.error("Không tìm thấy phòng này");
        } else {
          message.error(err.response?.data?.message || 'Không thể chuyển sang đặt theo hạng phòng');
        }
        navigate("/rooms");
      }
    };

    if (roomTypeIdParam) {
      const parsedTypeId = parseInt(roomTypeIdParam, 10);
      if (Number.isNaN(parsedTypeId) || parsedTypeId <= 0) {
        message.error("Hạng phòng không hợp lệ");
        navigate("/rooms");
      } else {
        void loadRoomType(parsedTypeId);
      }
    } else if (roomId) {
      const parsedId = parseInt(roomId, 10);
      if (Number.isNaN(parsedId) || parsedId <= 0) {
        message.error("Mã phòng không hợp lệ");
        navigate("/rooms");
      } else {
        void convertRoomIdToType(parsedId);
      }
    }

  }, [searchParams, setValue, navigate]);

  const calculateNights = () => {
    if (!dateRange[0] || !dateRange[1]) return 0;
    return dateRange[1].diff(dateRange[0], "day");
  };

  const nights = calculateNights();

  useEffect(() => {
    if (selectedRoom && selectedRoomsList.length === 0) {
      setSelectedRoomsList([
        {
          key: selectedRoom.roomTypeId || selectedRoom.id || Date.now(),
          mode: selectedRoom.mode,
          roomId: selectedRoom.id,
          roomTypeId: selectedRoom.roomTypeId,
          name: selectedRoom.name,
          image: selectedRoom.image,
          price: selectedRoom.price,
          beds: selectedRoom.beds,
          area: selectedRoom.area,
          capacity: selectedRoom.capacity,
          adultCapacity: selectedRoom.adultCapacity,
          childCapacity: selectedRoom.childCapacity,
          maxOccupancy: selectedRoom.maxOccupancy,
          extraAdultFee: selectedRoom.extraAdultFee,
          extraChildFee: selectedRoom.extraChildFee,
          status: selectedRoom.status,
          availableRooms: selectedRoom.availableRooms,
          quantity: roomQuantity,
          adults: adults,
          children: children,
          childrenAges: childrenAges
        }
      ]);
    }
  }, [selectedRoom]);

  const handleUpdateRoomType = async (key: any, roomTypeId: number) => {
    const typeOpt = roomTypes.find(t => t.id === roomTypeId);
    if (!typeOpt) return;

    setSelectedRoomsList(prev => prev.map(item => {
      if (item.key === key) {
        const adultCap = Number(typeOpt.adultCapacity ?? 2);
        const childCap = Number(typeOpt.childCapacity ?? 0);
        const cap = Number(typeOpt.capacity ?? (adultCap + childCap));
        const maxOcc = Number(typeOpt.maxOccupancy ?? cap);
        const exAdultFee = Number(typeOpt.extraAdultFee ?? 200000);
        const exChildFee = Number(typeOpt.extraChildFee ?? 100000);
        return {
          ...item,
          roomTypeId,
          name: typeOpt.typeName,
          price: Number(typeOpt.defaultPrice || 0),
          capacity: cap,
          adultCapacity: adultCap,
          childCapacity: childCap,
          maxOccupancy: maxOcc,
          extraAdultFee: exAdultFee,
          extraChildFee: exChildFee,
          beds: `${adultCap} NL + ${childCap} TE`,
          image: getRoomTypeCardImage(typeOpt.typeName)
        };
      }
      return item;
    }));
  };

  // Fix Item 5: Đặt phòng đích danh (mode === "room") ép roomQuantity = 1
  const canSubmitBooking =
    selectedRoomsList.length > 0 &&
    nights > 0 &&
    !submitting &&
    !availabilityChecking &&
    dateAvailability?.available !== false;

  const serviceAmount = serviceRequests.reduce((total, request) => {
    const service = services.find((item) => item.id === request.serviceId);
    return total + Number(service?.price || 0) * request.quantity;
  }, 0);

  const getServiceUsageRule = (service: Service) => {
    const name = service.serviceName.toLocaleLowerCase("vi");
    if (name.includes("breakfast") || name.includes("ăn sáng"))
      return "Sử dụng 06:30–10:00 mỗi ngày lưu trú.";
    if (name.includes("dinner") || name.includes("tối"))
      return "Sử dụng 18:00–21:30; đăng ký trước 16:00.";
    if (name.includes("spa") || name.includes("massage"))
      return "Sử dụng 09:00–22:00; đặt lịch trước ít nhất 2 giờ.";
    if (name.includes("airport") || name.includes("đưa đón"))
      return "Cung cấp giờ bay trước ít nhất 24 giờ.";
    if (
      name.includes("laundry") ||
      name.includes("giặt") ||
      name.includes("sấy")
    )
      return "Nhận đồ trước 10:00, hoàn trả trong ngày hoặc theo mô tả.";
    if (name.includes("extra bed") || name.includes("giường"))
      return "Tối đa 1 giường phụ/phòng; đăng ký trước 18:00 ngày nhận phòng.";
    if (name.includes("bicycle") || name.includes("xe đạp"))
      return "Sử dụng 06:00–20:00, trả xe trong ngày.";
    return "Sử dụng trong thời gian lưu trú; vui lòng liên hệ lễ tân để hẹn giờ.";
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN").format(price) + "₫";
  };

  const formatMoney = (price: number | string) => {
    return new Intl.NumberFormat("vi-VN").format(Number(price || 0)) + "đ";
  };

  const formatDate = (date?: string) => {
    if (!date) return "-";
    return dayjs(date).format("DD/MM/YYYY");
  };

  useEffect(() => {
    let cancelled = false;

    const verifyDateAvailability = async () => {
      if (
        selectedRoomsList.length === 0 ||
        !dateRange[0] ||
        !dateRange[1]
      ) {
        setDateAvailability(null);
        return;
      }

      setAvailabilityChecking(true);
      try {
        const response = await checkAvailability({
          checkIn: dateRange[0].format("YYYY-MM-DD"),
          checkOut: dateRange[1].format("YYYY-MM-DD"),
          rooms: selectedRoomsList.map(r => ({
            roomTypeId: r.roomTypeId,
            roomId: r.mode === "room" ? r.roomId : undefined,
            quantity: r.quantity,
            adults: r.adults,
            children: r.children,
            childrenAges: r.childrenAges.filter((age: any) => typeof age === "number" && age >= 0)
          }))
        });

        if (!cancelled) {
          setDateAvailability(response.data as DateAvailability);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          const err = error as {
            response?: {
              status?: number;
              data?: { details?: { conflictingBookingIds?: number[] } };
            };
          };
          if (err.response?.status === 409) {
            setDateAvailability({
              available: false,
              conflictingBookingIds:
                err.response.data?.details?.conflictingBookingIds || [],
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
  }, [selectedRoomsList, dateRange]);

  const onSubmit = async (data: BookingFormData) => {
    if (!isAuthenticated || !user?.id) {
      message.warning("Vui lòng đăng nhập để đặt phòng");
      navigate("/login");
      return;
    }

    if (selectedRoomsList.length === 0) {
      message.error("Vui lòng chọn phòng trước khi đặt");
      return;
    }

    if (!dateRange[0] || !dateRange[1]) {
      message.error("Vui lòng chọn ngày nhận và trả phòng");
      return;
    }

    // Validate selectedRoomsList
    for (let i = 0; i < selectedRoomsList.length; i++) {
      const r = selectedRoomsList[i];
      if (r.adults + r.children <= 0) {
        message.error(`Phòng thứ ${i + 1} phải có ít nhất một khách.`);
        return;
      }
      if (r.children > 0 && (r.childrenAges.length < r.children || r.childrenAges.some((age: any) => age === null || age === undefined || age < 0))) {
        message.error(`Vui lòng chọn tuổi cho tất cả trẻ em ở phòng thứ ${i + 1}.`);
        return;
      }
    }

    const checkIn = dateRange[0].format("YYYY-MM-DD");
    const checkOut = dateRange[1].format("YYYY-MM-DD");

    setSubmitting(true);
    try {
      const availability = await checkAvailability({
        checkIn,
        checkOut,
        rooms: selectedRoomsList.map(r => ({
          roomTypeId: r.roomTypeId,
          roomId: r.mode === "room" ? r.roomId : undefined,
          quantity: r.quantity,
          adults: r.adults,
          children: r.children,
          childrenAges: r.childrenAges.filter((age: any) => typeof age === "number" && age >= 0)
        }))
      });

      if (!availability.data.available) {
        message.error(
          "Rất tiếc, một số phòng bạn chọn đã hết chỗ hoặc không khả dụng trong khoảng ngày đã chọn. Vui lòng kiểm tra lại.",
        );
        return;
      }

      const bookingRes = await createBooking({
        userId: user.id,
        checkIn,
        checkOut,
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone,
        notes: data.specialRequests || null,
        serviceRequests,
        requestedCheckInTime: data.requestedCheckInTime || null,
        requestedCheckOutTime: data.requestedCheckOutTime || null,
        status: "confirmed",
        rooms: selectedRoomsList.map(r => ({
          roomTypeId: r.roomTypeId,
          roomId: r.mode === "room" ? r.roomId : undefined,
          quantity: r.quantity,
          adults: r.adults,
          children: r.children,
          childrenAges: r.childrenAges.filter((age: any) => typeof age === "number" && age >= 0)
        }))
      });

      message.success(
        "Đặt phòng thành công! Phòng được giữ tạm 15 phút, vui lòng thanh toán để xác nhận.",
      );
      const newBookingId = (bookingRes as { data?: { id?: number } })?.data?.id;
      navigate(
        newBookingId ? `/booking/${newBookingId}/payment` : "/booking/history",
      );
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const msg = err.response?.data?.message || "Đặt phòng thất bại";
      const errorMap: Record<string, string> = {
        "roomId must be a positive integer": "Mã phòng không hợp lệ",
        "roomId is required": "Vui lòng chọn lại hạng phòng",
        "roomTypeId must be a positive integer": "Hạng phòng không hợp lệ",
        "userId must be a positive integer":
          "Thông tin tài khoản không hợp lệ, vui lòng đăng nhập lại",
        "checkOut must be after checkIn":
          "Ngày trả phòng phải sau ngày nhận phòng",
      };
      message.error(errorMap[msg] || msg);
    } finally {
      setSubmitting(false);
    }
  };

  const computedRoomsCount = selectedRoomsList.reduce((sum, r) => sum + r.quantity, 0);
  const computedBaseTotal = dateAvailability?.stayAmount ?? selectedRoomsList.reduce((sum, r) => sum + r.price * r.quantity * (nights || 0), 0);
  const computedExtraSurcharge = dateAvailability?.childSurcharge?.amount ?? 0;
  const computedTotalAmount = computedBaseTotal + computedExtraSurcharge + serviceAmount;
  const computedDeposit = computedTotalAmount * 0.3;
  const computedRemaining = computedTotalAmount - computedDeposit;

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
                  <HistoryOutlined />
                  Lịch sử đặt phòng của bạn
                </span>
                <h2>Các chuyến đi gần đây</h2>
              </div>
              <Link to="/booking/history" className="history-view-all">
                Xem tất cả <ArrowRightOutlined />
              </Link>
            </div>

            {historyLoading ? (
              <div className="history-loading">
                Đang tải lịch sử đặt phòng...
              </div>
            ) : recentBookings.length > 0 ? (
              <div className="history-card-grid">
                {recentBookings.map((booking) => {
                  const status = bookingStatusMap[booking.status] || {
                    label: booking.status,
                    className: "default",
                  };

                  return (
                    <article className="history-card" key={booking.id}>
                      <div className="history-card-top">
                        <span className="history-code">#{booking.id}</span>
                        <span className={`history-status ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <h3>
                        {renderRoomTypesSummaryText(booking)}
                      </h3>
                      {canShowRoomNumber(booking.status) && (booking.booking_rooms?.length || booking.room_number) ? (
                        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                          Phòng: {booking.booking_rooms?.map(r => r.number).join(', ') || booking.room_number}
                        </div>
                      ) : !canShowRoomNumber(booking.status) ? (
                        <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>
                          Số phòng sẽ được sắp xếp khi nhận phòng
                        </p>
                      ) : null}
                      <div className="history-date">
                        <CalendarOutlined />
                        <span>
                          {formatDate(booking.check_in)} -{" "}
                          {formatDate(booking.check_out)}
                        </span>
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
                  <p>
                    Các đặt phòng mới của bạn sẽ xuất hiện tại đây để dễ theo
                    dõi.
                  </p>
                </div>
                <Link to="/rooms" className="history-empty-action">
                  Khám phá phòng
                </Link>
              </div>
            )}
          </section>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="booking-form-wrapper"
        >
          <div className="booking-main">
            {/* Section 1: Thông tin khách hàng */}
            <div className="booking-section">
              <h2>Thông tin khách hàng</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Họ và tên <span className="required">*</span>
                  </label>
                  <Controller
                    name="guestName"
                    control={control}
                    rules={{ required: "Vui lòng nhập họ tên" }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="Nhập họ và tên của bạn"
                        size="large"
                        prefix={<UserOutlined />}
                      />
                    )}
                  />
                  {errors.guestName && (
                    <span className="error-text">
                      {errors.guestName.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-row two-col">
                <div className="form-group">
                  <label>
                    Email <span className="required">*</span>
                  </label>
                  <Controller
                    name="guestEmail"
                    control={control}
                    rules={{
                      required: "Vui lòng nhập email",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Email không hợp lệ",
                      },
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
                  {errors.guestEmail && (
                    <span className="error-text">
                      {errors.guestEmail.message}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>
                    Số điện thoại <span className="required">*</span>
                  </label>
                  <Controller
                    name="guestPhone"
                    control={control}
                    rules={{
                      required: "Vui lòng nhập số điện thoại",
                      pattern: {
                        value: /^(0|\+84)[0-9]{9,10}$/,
                        message: "Số điện thoại không hợp lệ",
                      },
                    }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="0xxx xxx xxx"
                        size="large"
                        prefix={<PhoneOutlined />}
                      />
                    )}
                  />
                  {errors.guestPhone && (
                    <span className="error-text">
                      {errors.guestPhone.message}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Ngày lưu trú & Số lượng khách (UX Item 10) */}
            <div className="booking-section stay-guests-section">
              <div className="stay-guests-heading">
                <div>
                  <h2>Ngày lưu trú & Số lượng khách</h2>
                  <p>Chọn thời gian ở, hạng phòng và số khách đi cùng.</p>
                </div>
                {nights > 0 && (
                  <div className="nights-summary" aria-live="polite">
                    <strong>{nights}</strong>
                    <span>đêm lưu trú</span>
                  </div>
                )}
              </div>

              <div className="stay-dates-card">
              <div className="form-group stay-range-field">
                <label>
                  Ngày nhận và trả phòng <span className="required">*</span>
                </label>
                <RangePicker
                  style={{ width: "100%", height: "48px" }}
                  placeholder={["Ngày nhận phòng", "Ngày trả phòng"]}
                  format="DD/MM/YYYY"
                  disabledDate={(current) =>
                    current && current < dayjs().startOf("day")
                  }
                  value={dateRange}
                  onChange={(dates) => {
                    setDateRange(
                      dates as [dayjs.Dayjs | null, dayjs.Dayjs | null],
                    );
                    if (dates) {
                      setValue("checkIn", dates[0]?.format("YYYY-MM-DD") || "");
                      setValue(
                        "checkOut",
                        dates[1]?.format("YYYY-MM-DD") || "",
                      );
                    }
                  }}
                />
              </div>

              </div>

              <div className="guest-configuration-card">
                <div className="configuration-card-heading">
                  <span>Danh sách phòng đặt</span>
                  <small>Bạn có thể chọn nhiều hạng phòng khác nhau trong cùng một booking.</small>
                </div>

                {selectedRoomsList.map((roomItem, index) => {
                  const stdCap = Number(roomItem.capacity ?? ((roomItem.adultCapacity || 2) + (roomItem.childCapacity || 0)));
                  const maxOcc = Number(roomItem.maxOccupancy ?? stdCap);
                  const extraMax = Math.max(0, maxOcc - stdCap);
                  const extraAdultFee = Number(roomItem.extraAdultFee ?? 200000);
                  const extraChildFee = Number(roomItem.extraChildFee ?? 100000);
                  const cp = dateAvailability?.childrenPolicy || { freeMaxAge: 5, childMaxAge: 11, surchargePerNight: 200000 };

                  return (
                    <div key={roomItem.key} className="room-selection-row-item" style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: "20px", marginBottom: "20px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 600, color: "#1a1a1a" }}>Phòng #{index + 1}</span>
                        {selectedRoomsList.length > 1 && (
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              setSelectedRoomsList(prev => prev.filter(r => r.key !== roomItem.key));
                            }}
                          >
                            Xóa phòng
                          </Button>
                        )}
                      </div>

                      <div className="form-row two-col room-selection-grid">
                        <div className="form-group">
                          <label>Hạng phòng <span className="required">*</span></label>
                          <Select
                            value={roomItem.roomTypeId}
                            placeholder="Chọn hạng phòng"
                            size="large"
                            style={{ width: "100%" }}
                            options={roomTypes.map((type) => ({
                              value: type.id,
                              label: type.typeName,
                            }))}
                            onChange={(val) => handleUpdateRoomType(roomItem.key, val)}
                          />
                        </div>

                        <div className="form-group room-quantity-field">
                          <label>Số lượng phòng <span className="required">*</span></label>
                          <div className="room-quantity-row">
                            <button
                              type="button"
                              className="quantity-stepper-button"
                              disabled={roomItem.quantity <= 1}
                              onClick={() => {
                                setSelectedRoomsList(prev => prev.map(r => r.key === roomItem.key ? { ...r, quantity: Math.max(1, r.quantity - 1) } : r));
                              }}
                            >
                              −
                            </button>
                            <InputNumber
                              min={1}
                              max={20}
                              value={roomItem.quantity}
                              onChange={(val) => {
                                setSelectedRoomsList(prev => prev.map(r => r.key === roomItem.key ? { ...r, quantity: Math.max(1, Number(val || 1)) } : r));
                              }}
                              controls={false}
                              className="room-quantity-input"
                            />
                            <span className="room-quantity-unit">phòng</span>
                            <button
                              type="button"
                              className="quantity-stepper-button"
                              onClick={() => {
                                setSelectedRoomsList(prev => prev.map(r => r.key === roomItem.key ? { ...r, quantity: r.quantity + 1 } : r));
                              }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="extra-guest-policy-box" style={{ marginTop: "12px", padding: "12px 14px", background: "#fdf8f2", border: "1px solid #f2e3d3", borderRadius: "10px", fontSize: "13px", color: "#513c2b" }}>
                        <div style={{ fontWeight: 700, marginBottom: "4px", color: "#3f3024" }}>
                          Chính sách sức chứa &amp; khách phát sinh ({roomItem.name}):
                        </div>
                        <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: "1.5" }}>
                          <li>Sức chứa tiêu chuẩn: <strong>{stdCap} khách</strong></li>
                          <li>Sức chứa tối đa: <strong>{maxOcc} khách</strong></li>
                          {extraMax > 0 ? (
                            <>
                              <li>Có thể thêm tối đa <strong>{extraMax} khách phát sinh</strong>/phòng</li>
                              <li>Phụ thu người lớn: <strong>{formatPrice(extraAdultFee)}</strong>/người/đêm</li>
                              <li>Phụ thu trẻ em: <strong>{formatPrice(extraChildFee)}</strong>/trẻ/đêm</li>
                            </>
                          ) : (
                            <li>Hạng phòng này không nhận thêm khách phát sinh</li>
                          )}
                        </ul>
                      </div>

                      <div className="form-row two-col guest-count-grid" style={{ marginTop: "12px" }}>
                        <div className="form-group">
                          <label>Người lớn</label>
                          <Select
                            value={roomItem.adults}
                            onChange={(val) => {
                              setSelectedRoomsList(prev => prev.map(r => r.key === roomItem.key ? { ...r, adults: val } : r));
                            }}
                            options={Array.from({ length: 10 }, (_, i) => ({
                              value: i + 1,
                              label: `${i + 1} người lớn`,
                            }))}
                            size="large"
                            style={{ width: "100%" }}
                          />
                        </div>
                        <div className="form-group">
                          <label>Trẻ em</label>
                          <Select
                            value={roomItem.children}
                            onChange={(val) => {
                              setSelectedRoomsList(prev => prev.map(r => {
                                if (r.key === roomItem.key) {
                                  const newAges = Array(val).fill(null);
                                  return { ...r, children: val, childrenAges: newAges };
                                }
                                  return r;
                                }));
                              }}
                              options={Array.from({ length: 10 }, (_, i) => ({
                                value: i,
                                label: i === 0 ? "Không có trẻ em" : `${i} trẻ em`,
                              }))}
                              size="large"
                              style={{ width: "100%" }}
                            />
                          </div>
                        </div>

                        {roomItem.children > 0 && (
                          <div className="child-age-grid" style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "12px" }}>
                            {Array.from({ length: roomItem.children }).map((_, childIdx) => (
                              <div className="form-group" key={childIdx}>
                                <label>Tuổi trẻ {childIdx + 1} <span className="required">*</span></label>
                                <Select
                                  value={roomItem.childrenAges[childIdx] ?? undefined}
                                  placeholder="Tuổi"
                                  onChange={(val) => {
                                    setSelectedRoomsList(prev => prev.map(r => {
                                      if (r.key === roomItem.key) {
                                        const newAges = [...r.childrenAges];
                                        newAges[childIdx] = val;
                                        return { ...r, childrenAges: newAges };
                                      }
                                      return r;
                                    }));
                                  }}
                                  options={Array.from({ length: 12 }, (_, ageOption) => ({
                                    value: ageOption,
                                    label: `${ageOption} tuổi`,
                                  }))}
                                  size="large"
                                  style={{ width: "100%" }}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="children-policy-box" style={{ marginTop: "12px", padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", color: "#475467", lineHeight: "1.45" }}>
                          <strong style={{ color: "#334155" }}>Quy định trẻ em:</strong> 0–{cp.freeMaxAge} tuổi: Miễn phí · {cp.freeMaxAge + 1}–{cp.childMaxAge} tuổi: Phụ thu {formatPrice(cp.surchargePerNight)}/đêm · Từ {cp.childMaxAge + 1} tuổi: Tính như người lớn.
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="dashed"
                    onClick={() => {
                      if (roomTypes.length > 0) {
                        const typeOpt = roomTypes[0];
                        const adultCap = Number(typeOpt.adultCapacity ?? 2);
                        const childCap = Number(typeOpt.childCapacity ?? 0);
                        const cap = Number(typeOpt.capacity ?? (adultCap + childCap));
                        const maxOcc = Number(typeOpt.maxOccupancy ?? cap);
                        const exAdultFee = Number(typeOpt.extraAdultFee ?? 200000);
                        const exChildFee = Number(typeOpt.extraChildFee ?? 100000);
                        setSelectedRoomsList(prev => [
                          ...prev,
                          {
                            key: Date.now(),
                            roomTypeId: typeOpt.id,
                            name: typeOpt.typeName,
                            price: Number(typeOpt.defaultPrice || 0),
                            capacity: cap,
                            adultCapacity: adultCap,
                            childCapacity: childCap,
                            maxOccupancy: maxOcc,
                            extraAdultFee: exAdultFee,
                            extraChildFee: exChildFee,
                            quantity: 1,
                            adults: 2,
                            children: 0,
                            childrenAges: [],
                            beds: `${adultCap} NL + ${childCap} TE`,
                            image: getRoomTypeCardImage(typeOpt.typeName)
                          }
                        ]);
                      }
                    }}
                    block
                    icon={<PlusOutlined />}
                    size="large"
                    style={{ marginTop: "12px" }}
                  >
                    Thêm hạng phòng khác
                  </Button>
                  <div className="secondary-time-options">
                    <div className="secondary-options-heading">
                      <span>Tùy chọn thời gian</span>
                      <small>Không bắt buộc</small>
                    </div>
                    <div className="form-row two-col stay-time-grid">
                      <div className="form-group">
                        <label>Giờ nhận phòng mong muốn</label>
                        <Controller
                          name="requestedCheckInTime"
                          control={control}
                          render={({ field }) => (
                            <TimePicker
                              style={{ width: "100%" }}
                              size="large"
                              format="HH:mm"
                              minuteStep={15}
                              placeholder={`Mặc định ${shortTime(policies?.checkInTime) || "14:00"}`}
                              suffixIcon={<ClockCircleOutlined />}
                              value={field.value ? dayjs(field.value, "HH:mm") : null}
                              onChange={(time) =>
                                field.onChange(time ? time.format("HH:mm") : null)
                              }
                            />
                          )}
                        />
                      </div>
                      <div className="form-group">
                        <label>Giờ trả phòng mong muốn</label>
                        <Controller
                          name="requestedCheckOutTime"
                          control={control}
                          render={({ field }) => {
                            const standard = dayjs(
                              policies?.checkOutTime || "12:00:00",
                              "HH:mm:ss",
                            );
                            return (
                              <TimePicker
                                style={{ width: "100%" }}
                                size="large"
                                format="HH:mm"
                                minuteStep={15}
                                placeholder={`Mặc định ${shortTime(policies?.checkOutTime) || "12:00"}`}
                                suffixIcon={<ClockCircleOutlined />}
                                value={field.value ? dayjs(field.value, "HH:mm") : null}
                                disabledTime={() => ({
                                  disabledHours: () =>
                                    Array.from({ length: 24 }, (_, h) => h).filter(
                                      (h) => h > standard.hour(),
                                    ),
                                  disabledMinutes: (selectedHour) =>
                                    selectedHour === standard.hour()
                                      ? Array.from({ length: 60 }, (_, m) => m).filter(
                                          (m) => m > standard.minute(),
                                        )
                                      : [],
                                })}
                                onChange={(time) =>
                                  field.onChange(time ? time.format("HH:mm") : null)
                                }
                              />
                            );
                          }}
                        />
                      </div>
                    </div>
                    <p className="secondary-options-note">
                      Lễ tân sẽ chuẩn bị theo giờ bạn chọn; giờ trả chỉ nhận đến giờ chuẩn.
                    </p>
                  </div>
                </div>
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
                  style={{ width: "100%" }}
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
                        <div
                          className="service-request-row"
                          key={sel.serviceId}
                        >
                          <span className="service-request-name">
                            {svc?.serviceName}{" "}
                            <em>({formatMoney(svc?.price ?? 0)})</em>
                            {svc && (
                              <>
                                <small>
                                  {svc.description ||
                                    "Dịch vụ bổ sung cho phòng."}
                                </small>
                                <small className="service-usage-rule">
                                  {getServiceUsageRule(svc)}
                                </small>
                              </>
                            )}
                          </span>
                          <Space align="center">
                            {computedRoomsCount > 1 && (
                              <Select
                                size="middle"
                                value={sel.roomIndex || 1}
                                onChange={(v) =>
                                  updateServiceRoomIndex(sel.serviceId, v)
                                }
                                style={{ width: 110 }}
                                options={Array.from({ length: computedRoomsCount }, (_, idx) => ({
                                  value: idx + 1,
                                  label: `Phòng ${idx + 1}`,
                                }))}
                              />
                            )}
                            <Space.Compact>
                              <span className="ant-input-group-addon" style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#fafafa', border: '1px solid #d9d9d9', borderRight: 0, padding: '0 11px', color: 'rgba(0, 0, 0, 0.88)' }}>SL</span>
                              <InputNumber
                                min={1}
                                max={
                                  svc &&
                                  (svc.serviceName
                                    .toLocaleLowerCase("vi")
                                    .includes("extra bed") ||
                                    svc.serviceName
                                      .toLocaleLowerCase("vi")
                                      .includes("giường"))
                                    ? 1
                                    : 20
                                }
                                value={sel.quantity}
                                onChange={(v) =>
                                  updateServiceQuantity(sel.serviceId, v)
                                }
                              />
                            </Space.Compact>
                          </Space>
                        </div>
                      );
                    })}
                    <p className="service-request-note">
                      * Dịch vụ đã chọn được giữ cùng phòng và cộng ngay vào
                      tổng thanh toán.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="booking-sidebar">
            <div className="booking-summary">
              <h3>Tóm tắt đặt phòng</h3>

              <div className="booking-summary-scroll">
              {selectedRoomsList.length > 0 ? (
                <>
                  {selectedRoomsList.map((roomItem, idx) => {
                    const adultCap = Number(roomItem.adultCapacity ?? 2);
                    const childCap = Number(roomItem.childCapacity ?? 0);
                    const stdCapacity = Number(roomItem.capacity ?? (adultCap + childCap));
                    const maxOcc = Number(roomItem.maxOccupancy ?? stdCapacity);

                    return (
                      <div className="selected-room" key={roomItem.key || idx} style={{ marginBottom: "16px", borderBottom: "1px dashed #eee", paddingBottom: "12px" }}>
                        <img
                          src={roomItem.image}
                          alt={roomItem.name}
                          onError={(e) =>
                            handleRoomImageError(e, roomItem.name)
                          }
                        />
                        <div className="room-summary-info">
                          <div className="room-summary-heading">
                            <h4>{roomItem.name}</h4>
                          </div>
                          <p className="room-summary-meta">
                            {roomItem.quantity} phòng · Khách chọn: {roomItem.adults} NL + {roomItem.children} TE
                          </p>
                          <p style={{ fontSize: "12px", color: "#666", marginTop: "4px", lineHeight: "1.4" }}>
                            Tiêu chuẩn: {stdCapacity} khách · {adultCap} NL + {childCap} TE
                          </p>
                          <p style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                            Tối đa: {maxOcc} khách
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <div className="summary-details" style={{ marginTop: "16px" }}>
                    <div className="summary-row">
                      <span>Tổng số phòng</span>
                      <span>{computedRoomsCount} phòng</span>
                    </div>
                    <div className="summary-row">
                      <span>Số đêm</span>
                      <span>{nights > 0 ? `${nights} đêm` : "-"}</span>
                    </div>
                    {nights > 0 && (
                      <>
                        <div className="summary-row">
                          <span>Tiền phòng (tạm tính)</span>
                          <span>{formatPrice(computedBaseTotal)}</span>
                        </div>
                        {computedExtraSurcharge > 0 && (
                          <div className="summary-row extra-row">
                            <span>Phụ thu khách phát sinh</span>
                            <span>{formatPrice(computedExtraSurcharge)}</span>
                          </div>
                        )}
                        {serviceAmount > 0 && (
                          <div className="summary-row">
                            <span>Dịch vụ bổ sung</span>
                            <span>{formatPrice(serviceAmount)}</span>
                          </div>
                        )}
                        <div className="summary-row total" style={{ borderTop: "2px solid #eee", paddingTop: "12px" }}>
                          <span>Tổng cộng</span>
                          <span className="total-price" style={{ fontSize: "20px", color: "#1a1a1a" }}>
                            {formatPrice(computedTotalAmount)}
                          </span>
                        </div>
                        <div className="summary-row deposit" style={{ marginTop: "8px" }}>
                          <span style={{ fontWeight: 600, color: "#1890ff" }}>Tiền đặt cọc (30%)</span>
                          <span style={{ fontWeight: 600, color: "#1890ff" }}>{formatPrice(computedDeposit)}</span>
                        </div>
                        <div className="summary-row remaining" style={{ marginTop: "4px" }}>
                          <span style={{ color: "#888" }}>Còn lại (Thanh toán khi checkout)</span>
                          <span style={{ color: "#888" }}>{formatPrice(computedRemaining)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {nights > 0 && (
                    <div
                      className={`date-availability-note ${
                        availabilityChecking
                          ? "checking"
                          : dateAvailability?.available
                            ? "available"
                            : "unavailable"
                      }`}
                      style={{ marginTop: "12px" }}
                    >
                      {availabilityChecking
                        ? "Đang kiểm tra phòng trống..."
                        : dateAvailability?.available
                          ? "Tất cả các phòng bạn chọn đều còn trống."
                          : "Rất tiếc, một số hạng phòng bạn chọn đã hết phòng trong thời gian này."}
                    </div>
                  )}
                  <div className="booking-policies">
                    <h4>Chính sách</h4>
                    <ul>
                      <li>
                        <FontAwesomeIcon icon={faCheck} /> Hoàn{" "}
                        {policies?.nearTierPercent ?? 100}% khi hủy dưới{" "}
                        {policies?.nearTierMaxDays ?? 3} ngày,{" "}
                        {policies?.midTierPercent ?? 50}% khi hủy trước{" "}
                        {policies?.nearTierMaxDays ?? 3}–
                        {policies?.midTierMaxDays ?? 7} ngày
                      </li>
                      <li>
                        <FontAwesomeIcon icon={faCheck} /> Nhận phòng từ{" "}
                        {shortTime(policies?.checkInTime) || "14:00"}
                      </li>
                      <li>
                        <FontAwesomeIcon icon={faCheck} /> Trả phòng trước{" "}
                        {shortTime(policies?.checkOutTime) || "12:00"}
                      </li>
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
              </div>

              <button
                type="submit"
                className="btn-confirm-booking"
                disabled={!canSubmitBooking}
              >
                {submitting ? "Đang xử lý..." : "Xác nhận đặt phòng"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Booking;