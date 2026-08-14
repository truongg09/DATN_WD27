import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { Button,
  DatePicker,
  Input,
  InputNumber,
  Select,
  Space,
  TimePicker,
  Tag,
  message,
} from "antd";
import {
  ArrowRightOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBed,
  faCheck,
  faExpandArrowsAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../../contexts/AuthContext";
import { checkTypeAvailability,
  checkAvailability,
  createBooking,
  getBookings,
} from "../../services/bookingService";
import {
  getRoomById,
  getRoomTypes,
  getRoomTypeDetail,
  previewRoomPrice,
} from "../../services/roomService";
import type { RoomTypeSearchResult } from "../../services/roomService";
import { getServices } from "../../services/serviceService";
import type { Service } from "../../types/service";
import { unwrapList } from "../../utils/unwrapList";
import { BOOKING_STATUS_META } from "../../constants/bookingStatus";
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
  adultCapacity?: number;
  childCapacity?: number;
  maxOccupancy?: number;
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

// Dùng chung bảng nhãn ở constants/bookingStatus để không sót trạng thái no_show.
const bookingStatusMap = BOOKING_STATUS_META;

const roomStatusMap: Record<string, { label: string; className: string }> = {
  available: { label: "Còn trống", className: "available" },
  occupied: { label: "Đang có khách", className: "occupied" },
  maintenance: { label: "Đang bảo trì", className: "maintenance" },
};

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
  // Đặt kèm các hạng phòng KHÁC trong cùng một đơn (VD 1 Standard + 1 Superior).
  const [extraRoomTypes, setExtraRoomTypes] = useState<
    { roomTypeId: number; quantity: number }[]
  >([]);
  // Giá mỗi đêm của các hạng đặt thêm do máy chủ tính (đã gồm phụ thu ngày lễ và
  // cuối tuần), khóa theo id hạng phòng.
  const [extraTypeStayAmount, setExtraTypeStayAmount] = useState<
    Record<number, number>
  >({});
  const [services, setServices] = useState<Service[]>([]);
  // Mỗi dòng là một lượt chọn riêng (key tự tăng), nên cùng một dịch vụ có thể
  // xuất hiện nhiều dòng cho các phòng khác nhau.
  const [serviceRequests, setServiceRequests] = useState<
    { key: number; serviceId: number | null; quantity: number; roomIndex?: number }[]
  >([]);
  const serviceLineKey = useRef(1);
  const [childrenAges, setChildrenAges] = useState<(number | null)[]>([]);
  const [policies, setPolicies] = useState<PoliciesInfo | null>(null);

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

  const addServiceLine = () => {
    setServiceRequests((prev) => [
      ...prev,
      { key: serviceLineKey.current++, serviceId: null, quantity: 1, roomIndex: 1 },
    ]);
  };

  const removeServiceLine = (key: number) => {
    setServiceRequests((prev) => prev.filter((s) => s.key !== key));
  };

  const updateServiceLine = (
    key: number,
    patch: Partial<{ serviceId: number | null; quantity: number; roomIndex: number }>,
  ) => {
    setServiceRequests((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
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

    const loadRoom = async (parsedId: number) => {
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
          message.error(
            err.response?.data?.message ||
              "Không thể tải thông tin phòng. Vui lòng thử lại sau.",
          );
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
        loadRoomType(parsedTypeId);
      }
    } else if (roomId) {
      const parsedId = parseInt(roomId, 10);
      if (Number.isNaN(parsedId) || parsedId <= 0) {
        message.error("Mã phòng không hợp lệ");
        navigate("/rooms");
      } else {
        loadRoom(parsedId);
      }
    }

  }, [searchParams, setValue, navigate]);

  const calculateNights = () => {
    if (!dateRange[0] || !dateRange[1]) return 0;
    return dateRange[1].diff(dateRange[0], "day");
  };

  const nights = calculateNights();

  // Fix Item 5: Đặt phòng đích danh (mode === "room") ép roomQuantity = 1
  const isSpecificRoomMode = selectedRoom?.mode === "room";
  const activeRoomQuantity = isSpecificRoomMode ? 1 : roomQuantity;

  // Fix Item 7: Tính toán sức chứa & phụ thu khách phát sinh chuẩn hóa theo children_policy
  const adultCap = selectedRoom?.adultCapacity ?? selectedRoom?.capacity ?? 2;
  const childCap = selectedRoom?.childCapacity ?? 1;
  const maxOcc = selectedRoom?.maxOccupancy ?? adultCap + childCap;
  const extraAdultFee = selectedRoom?.extraAdultFee ?? 200000;
  const extraChildFee = selectedRoom?.extraChildFee ?? 100000;

  const validChildrenAges = childrenAges.filter(
    (age): age is number => typeof age === "number" && age >= 0,
  );
  // Fix Item 6: Kiểm tra nếu chưa chọn đủ tuổi cho tất cả trẻ em
  const hasUnselectedChildAge =
    children > 0 &&
    (childrenAges.length < children ||
      childrenAges.some((age) => age === null || age === undefined || age < 0));

  const freeMaxAge = dateAvailability?.childrenPolicy?.freeMaxAge ?? 5;

  const childMaxAge = dateAvailability?.childrenPolicy?.childMaxAge ?? 11;

  const adultsFromChildren = validChildrenAges.filter(
    (age) => age > childMaxAge,
  ).length;
  const chargeableChildrenCount = validChildrenAges.filter(
    (age) => age > freeMaxAge && age <= childMaxAge,
  ).length;

  const effectiveAdults = adults + adultsFromChildren;
  const effectiveChildren = Math.max(0, children - adultsFromChildren);
  const totalGuests = effectiveAdults + effectiveChildren;

  const minRequiredRooms =
    maxOcc > 0 ? Math.max(1, Math.ceil(totalGuests / maxOcc)) : 1;

  // Tự động nâng roomQuantity nếu số khách hiện tại vượt quá sức chứa tối đa của số phòng cũ (chế độ hạng phòng)
  useEffect(() => {
    if (selectedRoom && !isSpecificRoomMode && totalGuests > 0) {
      setRoomQuantity((prev) => Math.max(prev, minRequiredRooms));
    }
  }, [selectedRoom, isSpecificRoomMode, totalGuests, minRequiredRooms]);

  // Sức chứa phải cộng cả các hạng đặt thêm, nếu không thì khách đặt 1 Standard
  // + 1 Family cho 6 người vẫn bị báo vượt sức chứa và không bấm đặt được.
  const extraRoomsCapacity = extraRoomTypes.reduce(
    (acc, line) => {
      const type = roomTypes.find((t) => t.id === line.roomTypeId);
      if (!type) return acc;
      return {
        adults: acc.adults + Number(type.adultCapacity || 0) * line.quantity,
        children: acc.children + Number(type.childCapacity || 0) * line.quantity,
        maxOccupancy: acc.maxOccupancy + Number(type.maxOccupancy || 0) * line.quantity,
      };
    },
    { adults: 0, children: 0, maxOccupancy: 0 },
  );

  const totalAdultCapacity = adultCap * activeRoomQuantity + extraRoomsCapacity.adults;
  const totalChildCapacity = childCap * activeRoomQuantity + extraRoomsCapacity.children;
  const totalMaxOccupancy = maxOcc * activeRoomQuantity + extraRoomsCapacity.maxOccupancy;

  const extraAdults = Math.max(0, effectiveAdults - totalAdultCapacity);
  const rawExtraChildren = Math.max(0, effectiveChildren - totalChildCapacity);
  const extraChildren =
    validChildrenAges.length > 0
      ? Math.min(rawExtraChildren, chargeableChildrenCount)
      : rawExtraChildren;

  const extraAdultAmount = extraAdults * extraAdultFee * nights;
  const extraChildAmount = extraChildren * extraChildFee * nights;
  const totalExtraGuestFee = extraAdultAmount + extraChildAmount;

  const availableRoomsCount =
    dateAvailability?.availableRooms ?? selectedRoom?.availableRooms;

  // Fix Item 3: Sửa max={availableRoomsCount || 20} để khi availableRoomsCount = 0 không bị fallback thành 20
  const maxSelectableRooms =
    availableRoomsCount !== undefined && availableRoomsCount !== null
      ? Math.max(1, availableRoomsCount)
      : 20;

  // Fix Item 4: Kiểm tra nếu minRequiredRooms > availableRoomsCount (Hạng phòng không đủ phòng trống cho số khách)
  const isTypeNotEnoughForGuests =
    !isSpecificRoomMode &&
    availableRoomsCount !== undefined &&
    minRequiredRooms > availableRoomsCount;

  const isUserSelectedMoreThanAvailable =
    !isSpecificRoomMode &&
    availableRoomsCount !== undefined &&
    activeRoomQuantity > availableRoomsCount;

  const isGuestExceedingMax = totalGuests > totalMaxOccupancy;

  const isRoomDateUnavailable = dateAvailability?.available === false;
  const isRoomBlockedByStatus = selectedRoom?.status === "maintenance";

  const canSubmitBooking =
    Boolean(selectedRoom) &&
    !isRoomBlockedByStatus &&
    !isRoomDateUnavailable &&
    !isGuestExceedingMax &&
    !isTypeNotEnoughForGuests &&
    !isUserSelectedMoreThanAvailable &&
    !hasUnselectedChildAge &&
    nights > 0 &&
    !submitting &&
    !availabilityChecking;

  const calculateBaseTotal = () => {
    if (!selectedRoom || nights === 0) return 0;
    const unitPrice =
      dateAvailability?.stayAmount ?? selectedRoom.price * nights;
    return unitPrice * activeRoomQuantity;
  };

  // Tạm tính cho các hạng đặt thêm. Ưu tiên tiền phòng do máy chủ tính (đã gồm
  // phụ thu ngày lễ và cuối tuần), chỉ khi chưa có mới tạm lấy giá niêm yết.
  const extraRoomsAmount = extraRoomTypes.reduce((total, line) => {
    const stayAmount = extraTypeStayAmount[line.roomTypeId];
    if (stayAmount > 0) {
      return total + stayAmount * line.quantity;
    }
    const type = roomTypes.find((t) => t.id === line.roomTypeId);
    return total + Number(type?.defaultPrice || 0) * nights * line.quantity;
  }, 0);
  const totalSelectedRooms =
    activeRoomQuantity + extraRoomTypes.reduce((sum, line) => sum + line.quantity, 0);

  // Giảm số phòng thì các dòng dịch vụ đang trỏ tới phòng vừa bị bỏ phải kéo về
  // trong khoảng hợp lệ, nếu không máy chủ trả 400 "Phòng được chọn không hợp lệ"
  // mà trên màn hình vẫn thấy số phòng cũ.
  useEffect(() => {
    setServiceRequests((prev) => {
      let changed = false;
      const next = prev.map((line) => {
        const clamped = Math.min(Math.max(line.roomIndex ?? 1, 1), totalSelectedRooms);
        if (clamped !== line.roomIndex) {
          changed = true;
          return { ...line, roomIndex: clamped };
        }
        return line;
      });
      return changed ? next : prev;
    });
  }, [totalSelectedRooms]);

  // Hỏi máy chủ tiền phòng thật của từng hạng đặt thêm để khách nhìn thấy ngay
  // phần tăng giá ngày lễ / cuối tuần, thay vì chỉ nhân giá niêm yết với số đêm.
  const extraTypeIdsKey = extraRoomTypes
    .map((line) => line.roomTypeId)
    .filter(Boolean)
    .sort((a, b) => a - b)
    .join(',');
  useEffect(() => {
    const typeIds = extraTypeIdsKey ? extraTypeIdsKey.split(',').map(Number) : [];
    const checkIn = dateRange[0]?.format('YYYY-MM-DD');
    const checkOut = dateRange[1]?.format('YYYY-MM-DD');
    if (typeIds.length === 0 || !checkIn || !checkOut) {
      setExtraTypeStayAmount({});
      return;
    }

    let cancelled = false;
    Promise.all(
      typeIds.map((roomTypeId) =>
        previewRoomPrice({ roomTypeId, checkIn, checkOut })
          .then((res) => [roomTypeId, Number(res.data?.total || 0)] as const)
          .catch(() => [roomTypeId, 0] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setExtraTypeStayAmount(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [extraTypeIdsKey, dateRange]);

  const serviceAmount = serviceRequests.reduce((total, request) => {
    if (!request.serviceId) return total;
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
        !selectedRoom ||
        selectedRoom.status === "maintenance" ||
        !dateRange[0] ||
        !dateRange[1]
      ) {
        setDateAvailability(null);
        return;
      }

      setAvailabilityChecking(true);
      try {
        const response = await checkAvailability({
          ...(selectedRoom.mode === "type"
            ? { roomTypeId: selectedRoom.roomTypeId }
            : { roomId: selectedRoom.id }),
          checkIn: dateRange[0].format("YYYY-MM-DD"),
          checkOut: dateRange[1].format("YYYY-MM-DD"),
          childrenAges: validChildrenAges,
        });

        if (!cancelled) {
          const resultData = (response as any)?.data?.data ?? (response as any)?.data ?? response;
          setDateAvailability(resultData as DateAvailability);
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
  }, [selectedRoom, dateRange, childrenAges]);

  const onSubmit = async (data: BookingFormData) => {
    if (!isAuthenticated || !user?.id) {
      message.warning("Vui lòng đăng nhập để đặt phòng");
      navigate("/login");
      return;
    }

    if (!selectedRoom) {
      message.error("Vui lòng chọn phòng trước khi đặt");
      return;
    }

    if (selectedRoom.status === "maintenance") {
      const statusLabel =
        roomStatusMap[selectedRoom.status]?.label || "không còn trống";
      message.error(
        `Phòng này hiện ${statusLabel.toLowerCase()}, vui lòng chọn phòng khác`,
      );
      return;
    }

    if (!dateRange[0] || !dateRange[1]) {
      message.error("Vui lòng chọn ngày nhận và trả phòng");
      return;
    }

    if (isRoomDateUnavailable) {
      message.error(
        "Phòng đã có người đặt trong khoảng thời gian này, vui lòng chọn ngày khác",
      );
      return;
    }

    if (hasUnselectedChildAge) {
      message.error(
        "Vui lòng chọn tuổi cho tất cả trẻ em đi cùng trước khi đặt phòng.",
      );
      return;
    }

    if (isTypeNotEnoughForGuests) {
      message.error(
        `Hạng phòng này không đủ phòng cho đoàn khách (${totalGuests} người cần ít nhất ${minRequiredRooms} phòng, hiện chỉ còn ${availableRoomsCount} phòng trống).`,
      );
      return;
    }

    if (isGuestExceedingMax) {
      message.error(
        `Tổng số khách (${totalGuests}) vượt quá sức chứa tối đa của ${activeRoomQuantity} phòng (${totalMaxOccupancy} người). Vui lòng chọn ít nhất ${minRequiredRooms} phòng.`,
      );
      return;
    }

    if (isUserSelectedMoreThanAvailable) {
      message.error(
        `Hạng phòng này chỉ còn ${availableRoomsCount} phòng trống trong khoảng ngày đã chọn.`,
      );
      return;
    }

    const checkIn = dateRange[0].format("YYYY-MM-DD");
    const checkOut = dateRange[1].format("YYYY-MM-DD");

    // Fix Item 5: Đặt phòng đích danh (mode === "room") chỉ gửi roomId, KHÔNG gửi roomQuantity > 1
    const hasExtraTypes =
      selectedRoom.mode === "type" && extraRoomTypes.length > 0;
    const roomSelector =
      selectedRoom.mode === "type"
        ? hasExtraTypes
          ? {
              rooms: [
                { roomTypeId: selectedRoom.roomTypeId, quantity: activeRoomQuantity },
                ...extraRoomTypes.map((line) => ({
                  roomTypeId: line.roomTypeId,
                  quantity: line.quantity,
                })),
              ],
            }
          : {
              roomTypeId: selectedRoom.roomTypeId,
              roomQuantity: activeRoomQuantity,
            }
        : { roomId: selectedRoom.id, roomQuantity: 1 };

    setSubmitting(true);
    try {
      const availability = hasExtraTypes
        ? await checkTypeAvailability({
            checkIn,
            checkOut,
            rooms: (roomSelector as { rooms: { roomTypeId: number; quantity: number }[] }).rooms,
          })
        : await checkAvailability({
            ...roomSelector,
            checkIn,
            checkOut,
            childrenAges: validChildrenAges,
          });

      const availData = (availability as any)?.data?.data ?? (availability as any)?.data ?? availability;
      if (!availData?.available) {
        message.error(
          availData?.message ||
            "Rất tiếc, hạng phòng vừa hết chỗ trong khoảng ngày đã chọn. Vui lòng chọn ngày hoặc hạng phòng khác.",
        );
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
        childrenAges: validChildrenAges,
        notes: data.specialRequests || null,
        serviceRequests: serviceRequests
          .filter((line) => line.serviceId)
          .map(({ serviceId, quantity, roomIndex }) => ({
            serviceId,
            quantity,
            // Đơn một phòng thì không cần chỉ định phòng nào. Kẹp lại trong
            // khoảng hợp lệ để không gửi lên số phòng đã bị bỏ đi.
            roomIndex:
              totalSelectedRooms > 1
                ? Math.min(Math.max(roomIndex ?? 1, 1), totalSelectedRooms)
                : undefined,
          })),
        requestedCheckInTime: data.requestedCheckInTime || null,
        requestedCheckOutTime: data.requestedCheckOutTime || null,
        status: "confirmed",
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
                        {booking.status === 'checked_in' && booking.room_number
                          ? `Phòng ${booking.room_number} - ${booking.room_type_name || ''}`
                          : booking.room_type_name || 'Đặt phòng'}
                      </h3>
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
                  <span>Thông tin phòng và khách</span>
                  <small>Hệ thống sẽ kiểm tra sức chứa ngay khi bạn chọn.</small>
                </div>
              <div className="form-row two-col room-selection-grid">
              <div className="form-group">
                <label>
                  Hạng phòng <span className="required">*</span>
                </label>

                <Select
                  value={selectedRoom?.roomTypeId}
                  placeholder="Chọn hạng phòng"
                  size="large"
                  style={{ width: "100%" }}
                  options={roomTypes.map((type) => ({
                    value: type.id,
                    label: type.typeName,
                  }))}
                  onChange={(roomTypeId) => {
                    // Nếu hạng vừa chọn đang nằm trong danh sách đặt thêm thì
                    // phải bỏ nó ra, không thì cùng một hạng bị tính hai lần và
                    // số phòng lẫn tiền của đơn đều nhân đôi.
                    setExtraRoomTypes((prev) =>
                      prev.filter((line) => line.roomTypeId !== roomTypeId),
                    );

                    const params = new URLSearchParams(searchParams);

                    params.delete("id");
                    params.set("type", String(roomTypeId));

                    if (dateRange[0]) {
                      params.set("checkIn", dateRange[0].format("YYYY-MM-DD"));
                    }

                    if (dateRange[1]) {
                      params.set("checkOut", dateRange[1].format("YYYY-MM-DD"));
                    }

                    params.set("adults", String(adults));
                    params.set("children", String(children));

                    const validAges = childrenAges.filter(
                      (age): age is number =>
                        typeof age === "number" && age >= 0,
                    );

                    if (validAges.length > 0) {
                      params.set("childAges", validAges.join(","));
                    } else {
                      params.delete("childAges");
                    }

                    params.set("roomQuantity", String(roomQuantity));
                    setDateAvailability(null);

                    const scrollPosition = window.scrollY;
                    navigate(`/booking?${params.toString()}`, { replace: true });
                    window.requestAnimationFrame(() => {
                      window.requestAnimationFrame(() =>
                        window.scrollTo({ top: scrollPosition }),
                      );
                    });
                  }}
                />
              </div>

              {!isSpecificRoomMode ? (
                <div className="form-group room-quantity-field">
                  <label>
                    Số lượng phòng <span className="required">*</span>
                  </label>
                  <div className="room-quantity-row">
                    <button
                      type="button"
                      className="quantity-stepper-button"
                      aria-label="Giảm số lượng phòng"
                      disabled={roomQuantity <= 1 || availableRoomsCount === 0}
                      onClick={() => setRoomQuantity((value) => Math.max(1, value - 1))}
                    >
                      −
                    </button>
                    <InputNumber
                      min={1}
                      max={maxSelectableRooms}
                      disabled={availableRoomsCount === 0}
                      value={roomQuantity}
                      onChange={(value) =>
                        setRoomQuantity(Math.max(1, Number(value || 1)))
                      }
                      controls={false}
                      className="room-quantity-input"
                    />
                    <span className="room-quantity-unit">phòng</span>
                    <button
                      type="button"
                      className="quantity-stepper-button"
                      aria-label="Tăng số lượng phòng"
                      disabled={
                        availableRoomsCount === 0 ||
                        roomQuantity >= maxSelectableRooms
                      }
                      onClick={() =>
                        setRoomQuantity((value) =>
                          Math.min(maxSelectableRooms, value + 1),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                  {dateRange[0] && dateRange[1] && availableRoomsCount !== undefined && (
                    <span className="room-availability-helper">
                      Còn {availableRoomsCount} phòng trong thời gian đã chọn
                    </span>
                  )}
                  {minRequiredRooms > 1 &&
                    activeRoomQuantity < minRequiredRooms && (
                      <span className="suggested-q-tag">
                        Với số khách hiện tại, cần ít nhất {minRequiredRooms} phòng.
                      </span>
                    )}
                </div>
              ) : (
                <div className="specific-room-notice">
                  <p>
                    Đang đặt đích danh phòng{" "}
                    <strong>
                      #{selectedRoom?.roomNumber || selectedRoom?.id}
                    </strong>
                    . Số lượng cố định: 1 phòng.
                  </p>
                </div>
              )}
              </div>

              {!isSpecificRoomMode && selectedRoom && (
                <div className="form-group" style={{ marginTop: -8 }}>
                  {extraRoomTypes.map((line, index) => {
                    const usedIds = [
                      selectedRoom.roomTypeId,
                      ...extraRoomTypes.filter((_, i) => i !== index).map((l) => l.roomTypeId),
                    ];
                    return (
                      <div
                        key={index}
                        style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}
                      >
                        <Select
                          style={{ flex: 1 }}
                          value={line.roomTypeId}
                          placeholder="Chọn hạng phòng đặt thêm"
                          optionFilterProp="label"
                          onChange={(v) =>
                            setExtraRoomTypes((prev) =>
                              prev.map((l, i) => (i === index ? { ...l, roomTypeId: v } : l)),
                            )
                          }
                          options={roomTypes
                            .filter((t) => !usedIds.includes(t.id))
                            .map((t) => ({
                              value: t.id,
                              label: `${t.typeName} — ${formatMoney(Number(t.defaultPrice || 0))}/đêm`,
                            }))}
                        />
                        <InputNumber
                          min={1}
                          max={5}
                          value={line.quantity}
                          onChange={(v) =>
                            setExtraRoomTypes((prev) =>
                              prev.map((l, i) =>
                                i === index ? { ...l, quantity: Number(v || 1) } : l,
                              ),
                            )
                          }
                          addonBefore="SL"
                          style={{ width: 120 }}
                        />
                        <Button
                          type="text"
                          danger
                          onClick={() =>
                            setExtraRoomTypes((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          Xóa
                        </Button>
                      </div>
                    );
                  })}
                  {roomTypes.length > extraRoomTypes.length + 1 && (
                    <Button
                      type="link"
                      size="small"
                      style={{ paddingLeft: 0 }}
                      onClick={() => {
                        const usedIds = [
                          selectedRoom.roomTypeId,
                          ...extraRoomTypes.map((l) => l.roomTypeId),
                        ];
                        const firstFree = roomTypes.find((t) => !usedIds.includes(t.id));
                        if (firstFree) {
                          setExtraRoomTypes((prev) => [
                            ...prev,
                            { roomTypeId: firstFree.id, quantity: 1 },
                          ]);
                        }
                      }}
                    >
                      + Đặt thêm hạng phòng khác
                    </Button>
                  )}
                  {/* Chưa chọn ngày thì chưa có số đêm, hiện "0đ (0 đêm)" chỉ gây
                      khó hiểu nên nhắc khách chọn ngày trước. */}
                  {extraRoomTypes.length > 0 && (
                    <small style={{ color: '#64748b', display: 'block', marginTop: 6 }}>
                      {nights > 0 ? (
                        <>
                          Tạm tính phần đặt thêm: {formatMoney(extraRoomsAmount)} cho {nights} đêm.
                          Giá ngày lễ và cuối tuần sẽ được hệ thống tính lại khi xác nhận.
                        </>
                      ) : (
                        <>Chọn ngày nhận và trả phòng để xem tạm tính cho phần đặt thêm.</>
                      )}
                    </small>
                  )}
                </div>
              )}

              {/* UX Item 10: Người lớn / Trẻ em / Tuổi trẻ em hiển thị TRƯỚC Số lượng phòng */}
              <div className="form-row two-col guest-count-grid">
                <div className="form-group">
                  <label>Người lớn</label>
                  <Select
                    value={adults}
                    onChange={(value) => setValue("adults", value)}
                    // Danh sách phải phủ được giá trị nhận từ URL. Cố định 5 mục
                    // thì khách vào bằng liên kết có adults=7 sẽ thấy antd in
                    // trơ số 7 mà không chọn lại được vì không có mục nào khớp.
                    options={Array.from({ length: Math.max(5, adults) }, (_, i) => ({
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
                    value={children}
                    onChange={(value) => setValue("children", value)}
                    options={Array.from({ length: Math.max(5, children + 1) }, (_, i) => ({
                      value: i,
                      label: i === 0 ? "Không có trẻ em" : `${i} trẻ em`,
                    }))}
                    size="large"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              {children > 0 && (
                <div className="child-age-grid">
                  {childrenAges.map((age, index) => (
                    <div className="form-group" key={index}>
                      <label>
                        Tuổi trẻ em {index + 1}{" "}
                        <span className="required">*</span>
                      </label>
                      <Select
                        value={
                          typeof age === "number" && age >= 0 ? age : undefined
                        }
                        placeholder="-- Chọn tuổi trẻ em --"
                        onChange={(value) =>
                          setChildrenAges((prev) =>
                            prev.map((item, i) => (i === index ? value : item)),
                          )
                        }
                        options={Array.from(
                          { length: Math.max(12, (typeof age === "number" ? age : 0) + 1) },
                          (_, ageOption) => ({
                            value: ageOption,
                            label: `${ageOption} tuổi`,
                          }),
                        )}
                        size="large"
                        style={{ width: "100%" }}
                      />
                    </div>
                  ))}
                  {dateAvailability?.childrenPolicy && (
                    <p
                      className="service-request-note"
                      style={{ width: "100%" }}
                    >
                      * 0–{dateAvailability.childrenPolicy.freeMaxAge} tuổi miễn
                      phí · {dateAvailability.childrenPolicy.freeMaxAge + 1}–
                      {dateAvailability.childrenPolicy.childMaxAge} tuổi phụ thu{" "}
                      {formatMoney(
                        dateAvailability.childrenPolicy.surchargePerNight,
                      )}
                      /đêm · từ{" "}
                      {dateAvailability.childrenPolicy.childMaxAge + 1} tuổi
                      được tính là người lớn
                    </p>
                  )}
                </div>
              )}

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

              {dateAvailability?.nightlyPrices && (dateAvailability.nightlyPrices as any[]).some((n: any) => n.isHoliday || n.isSunday || n.isSaturday || n.price > Number(selectedRoom?.price || 0)) && (
                <div style={{ marginTop: 16, padding: '14px 16px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d46b08', fontWeight: 600, fontSize: 14 }}>
                    <span>⚠️ Khoảng thời gian lưu trú có chứa đêm Thứ 7 / Chủ nhật / Dịp lễ</span>
                  </div>
                  <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#595959' }}>
                    Đơn giá cho các đêm cuối tuần và ngày lễ được áp dụng theo quy định của khách sạn (phụ thu +100.000đ/đêm với phòng thường, +200.000đ/đêm với phòng hạng sang):
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(dateAvailability.nightlyPrices as any[]).map((night: any, idx: number) => {
                      const isSpecial = night.isHoliday || night.isSunday || night.isSaturday || night.price > Number(selectedRoom?.price || 0);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 13,
                            background: '#fff',
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid #f0f0f0'
                          }}
                        >
                          <span>
                            <strong>{dayjs(night.date || night.stayDate).format('DD/MM/YYYY')}</strong> ({night.dayName || ''})
                            {night.isHoliday && <Tag color="red" style={{ marginLeft: 6 }}>Dịp lễ</Tag>}
                            {night.isSunday && <Tag color="orange" style={{ marginLeft: 6 }}>Chủ nhật</Tag>}
                            {night.isSaturday && <Tag color="purple" style={{ marginLeft: 6 }}>Thứ 7</Tag>}
                            {!night.isHoliday && !night.isSunday && !night.isSaturday && <Tag color="blue" style={{ marginLeft: 6 }}>Ngày thường</Tag>}
                            {night.note && <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 4 }}>({night.note})</span>}
                          </span>
                          <span style={{ fontWeight: 600, color: isSpecial ? '#cf1322' : '#0f172a' }}>
                            {formatMoney(night.price)} / phòng
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="capacity-alert-wrapper">
                  {isTypeNotEnoughForGuests ? (
                    <div className="capacity-alert-box danger">
                      <strong>Hạng phòng không đủ phòng trống!</strong>
                      <p>
                        Số khách của bạn ({totalGuests} người) cần ít nhất{" "}
                        {minRequiredRooms} phòng, nhưng hạng phòng này hiện chỉ
                        còn {availableRoomsCount} phòng trống. Vui lòng giảm số
                        khách hoặc chọn hạng phòng khác.
                      </p>
                    </div>
                  ) : isGuestExceedingMax ? (
                    <div className="capacity-alert-box danger">
                      <strong>Vượt quá sức chứa tối đa!</strong>
                      <p>
                        Tổng {totalGuests} khách ({effectiveAdults} NL +{" "}
                        {effectiveChildren} TE) vượt quá sức chứa tối đa của{" "}
                        {activeRoomQuantity} phòng ({totalMaxOccupancy} người).
                        Vui lòng chọn ít nhất {minRequiredRooms} phòng hoặc giảm
                        số khách.
                      </p>
                    </div>
                  ) : isUserSelectedMoreThanAvailable ? (
                    <div className="capacity-alert-box warning">
                      <strong>Không đủ phòng trống!</strong>
                      <p>
                        Hạng phòng này chỉ còn {availableRoomsCount} phòng trống
                        trong khoảng ngày đã chọn. Vui lòng chọn tối đa{" "}
                        {availableRoomsCount} phòng.
                      </p>
                    </div>
                  ) : hasUnselectedChildAge ? (
                    <div className="capacity-alert-box warning">
                      <strong>Vui lòng chọn tuổi trẻ em!</strong>
                      <p>
                        Vui lòng chọn đầy đủ tuổi của từng trẻ em đi cùng để hệ
                        thống áp dụng đúng chính sách phụ thu.
                      </p>
                    </div>
                  ) : null}
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

                {/* Mỗi dòng là một lượt chọn độc lập nên cùng một dịch vụ có
                    thể đặt cho nhiều phòng khác nhau. */}
                {serviceRequests.length > 0 && (
                  <div className="service-request-list">
                    {serviceRequests.map((line) => {
                      const svc = services.find((s) => s.id === line.serviceId);
                      const isBedService = svc
                        ? svc.serviceName.toLocaleLowerCase("vi").includes("extra bed") ||
                          svc.serviceName.toLocaleLowerCase("vi").includes("giường")
                        : false;
                      return (
                        <div className="service-request-row" key={line.key}>
                          <span className="service-request-name" style={{ flex: 1 }}>
                            <Select
                              size="middle"
                              style={{ width: "100%" }}
                              placeholder="Chọn dịch vụ"
                              value={line.serviceId ?? undefined}
                              onChange={(v) => updateServiceLine(line.key, { serviceId: v })}
                              optionFilterProp="label"
                              showSearch
                              options={services.map((sv) => ({
                                value: sv.id,
                                label: `${sv.serviceName} - ${formatMoney(sv.price)}`,
                              }))}
                            />
                            {svc && (
                              <small className="service-usage-rule">
                                {getServiceUsageRule(svc)}
                              </small>
                            )}
                          </span>
                          <Space align="center">
                            {totalSelectedRooms > 1 && (
                              <Select
                                size="middle"
                                value={line.roomIndex || 1}
                                onChange={(v) => updateServiceLine(line.key, { roomIndex: v })}
                                style={{ width: 110 }}
                                options={Array.from({ length: totalSelectedRooms }, (_, idx) => ({
                                  value: idx + 1,
                                  label: `Phòng ${idx + 1}`,
                                }))}
                              />
                            )}
                            <InputNumber
                              min={1}
                              max={isBedService ? 1 : 20}
                              value={line.quantity}
                              onChange={(v) =>
                                updateServiceLine(line.key, { quantity: Number(v || 1) })
                              }
                              addonBefore="SL"
                            />
                            <Button
                              type="text"
                              danger
                              onClick={() => removeServiceLine(line.key)}
                            >
                              Xóa
                            </Button>
                          </Space>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  type="dashed"
                  block
                  style={{ marginTop: serviceRequests.length > 0 ? 8 : 0 }}
                  onClick={addServiceLine}
                >
                  + Thêm dịch vụ
                </Button>
                {serviceRequests.length > 0 && (
                  <p className="service-request-note">
                    * Dịch vụ đã chọn được giữ cùng phòng và cộng ngay vào tổng
                    thanh toán. Có thể chọn cùng một dịch vụ cho nhiều phòng.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="booking-sidebar">
            <div className="booking-summary">
              <h3>Tóm tắt đặt phòng</h3>

              <div className="booking-summary-scroll">
              {selectedRoom ? (
                <>
                  <div className="selected-room">
                    <img
                      src={selectedRoom.image}
                      alt={selectedRoom.name}
                      onError={(e) =>
                        handleRoomImageError(e, selectedRoom.name)
                      }
                    />
                    <div className="room-summary-info">
                      <div className="room-summary-heading">
                        <h4>{selectedRoom.name}</h4>
                        {selectedRoom.mode === "room" && (
                          <span
                            className={`room-status-badge ${roomStatusMap[selectedRoom.status]?.className || "default"}`}
                          >
                            {roomStatusMap[selectedRoom.status]?.label ||
                              selectedRoom.status}
                          </span>
                        )}
                      </div>
                      {selectedRoom.mode === "room" &&
                        selectedRoom.roomNumber && (
                          <p className="room-number-line">
                            Phòng {selectedRoom.roomNumber}
                          </p>
                        )}
                      <p className="room-summary-meta">
                        {activeRoomQuantity} phòng đã chọn
                      </p>
                      <p>
                        <FontAwesomeIcon icon={faBed} /> Sức chứa:{" "}
                        {selectedRoom.beds}
                      </p>
                      <p>
                        <FontAwesomeIcon icon={faExpandArrowsAlt} />{" "}
                        {selectedRoom.area}
                      </p>
                    </div>
                  </div>

                  <div className="capacity-preview-box">
                    <span className="capacity-preview-title">Sức chứa</span>
                    <div className="capacity-spec-row">
                      <span className="spec-label">Tiêu chuẩn:</span>
                      <span className="spec-val">
                        {totalAdultCapacity} NL + {totalChildCapacity} TE
                      </span>
                    </div>
                    <div className="capacity-spec-row">
                      <span className="spec-label">Tối đa:</span>
                      <span className="spec-val">
                        {totalMaxOccupancy} khách
                      </span>
                    </div>
                    <div className="capacity-spec-row">
                      <span className="spec-label">Khách của bạn:</span>
                      <span className="spec-val">
                        {effectiveAdults} NL + {effectiveChildren} TE
                      </span>
                    </div>
                    {(extraAdults > 0 || extraChildren > 0) && (
                      <div className="capacity-spec-row extra">
                        <span className="spec-label">Phát sinh</span>
                        <span className="spec-val highlight">
                          {extraAdults} NL + {extraChildren} TE
                        </span>
                      </div>
                    )}

                    {totalExtraGuestFee > 0 && (
                      <div className="extra-fee-box">
                        <span className="extra-fee-title">
                          Phụ thu khách phát sinh
                        </span>
                        {extraAdults > 0 && (
                          <div className="extra-fee-item">
                            <span>{extraAdults} người lớn</span>
                            <small>
                              {extraAdults} × {formatMoney(extraAdultFee)} × {nights} đêm
                            </small>
                            <strong>= {formatMoney(extraAdultAmount)}</strong>
                          </div>
                        )}
                        {extraChildren > 0 && (
                          <div className="extra-fee-item">
                            <span>{extraChildren} trẻ em</span>
                            <small>
                              {extraChildren} × {formatMoney(extraChildFee)} × {nights} đêm
                            </small>
                            <strong>= {formatMoney(extraChildAmount)}</strong>
                          </div>
                        )}
                        <div className="extra-fee-total">
                          <span>Tổng phụ thu</span>
                          <strong>{formatMoney(totalExtraGuestFee)}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedRoom.mode === "type" && (
                    <p
                      className="service-request-note"
                      style={{ marginTop: 8 }}
                    >
                      * Số phòng cụ thể sẽ được khách sạn sắp xếp và thông báo
                      khi nhận phòng.
                    </p>
                  )}

                  <div className="summary-details">
                    <div className="summary-row">
                      <span>Số lượng phòng</span>
                      <span>{activeRoomQuantity} phòng</span>
                    </div>
                    <div className="summary-row">
                      <span>Số đêm</span>
                      <span>{nights > 0 ? `${nights} đêm` : "-"}</span>
                    </div>
                    <div className="summary-row">
                      <span>Giá phòng</span>
                      <span>
                        {formatPrice(selectedRoom.price)} / phòng / đêm
                      </span>
                    </div>
                    {nights > 0 && (() => {
                      const baseStandardRoomTotal = nights * (selectedRoom?.price || 0) * activeRoomQuantity;
                      const actualStayRoomTotal = calculateBaseTotal();
                      const weekendHolidaySurchargeTotal = Math.max(0, actualStayRoomTotal - baseStandardRoomTotal);

                      return (
                        <>
                          <div className="summary-row">
                            <span>Tiền phòng tiêu chuẩn ({activeRoomQuantity} phòng)</span>
                            <span>{formatPrice(baseStandardRoomTotal)}</span>
                          </div>
                          {weekendHolidaySurchargeTotal > 0 && (
                            <div className="summary-row extra-row" style={{ color: '#cf1322', fontWeight: 600 }}>
                              <span>Phụ thu Cuối tuần / Dịp lễ</span>
                              <span>+{formatPrice(weekendHolidaySurchargeTotal)}</span>
                            </div>
                          )}
                          {totalExtraGuestFee > 0 && (
                            <div className="summary-row extra-row">
                              <span>Phụ thu khách phát sinh</span>
                              <span>+{formatPrice(totalExtraGuestFee)}</span>
                            </div>
                          )}
                          {serviceAmount > 0 && (
                            <div className="summary-row">
                              <span>Dịch vụ bổ sung</span>
                              <span>+{formatPrice(serviceAmount)}</span>
                            </div>
                          )}
                          {extraRoomsAmount > 0 && (
                            <div className="summary-row">
                              <span>
                                Hạng phòng đặt thêm (
                                {extraRoomTypes
                                  .map((line) => {
                                    const type = roomTypes.find((t) => t.id === line.roomTypeId);
                                    return `${line.quantity} ${type?.typeName || ''}`;
                                  })
                                  .join(', ')}
                                )
                              </span>
                              <span>+{formatPrice(extraRoomsAmount)}</span>
                            </div>
                          )}
                          <div className="summary-row total">
                            <span>Tổng cộng (tạm tính)</span>
                            <span className="total-price">
                              {formatPrice(
                                actualStayRoomTotal +
                                  extraRoomsAmount +
                                  totalExtraGuestFee +
                                  serviceAmount,
                              )}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {nights > 0 && (
                    <div
                      className={`date-availability-note ${
                        availabilityChecking
                          ? "checking"
                          : isRoomDateUnavailable
                            ? "unavailable"
                            : dateAvailability?.available
                              ? "available"
                              : ""
                      }`}
                    >
                      {availabilityChecking
                        ? "Đang kiểm tra phòng trống theo ngày đã chọn..."
                        : isRoomDateUnavailable
                          ? selectedRoom.mode === "type"
                            ? "Rất tiếc, hạng phòng này đã hết phòng trống trong khoảng ngày bạn chọn. Vui lòng chọn ngày khác hoặc hạng phòng khác."
                            : "Rất tiếc, phòng này đã có khách giữ chỗ trong khoảng ngày bạn chọn. Bạn vui lòng chọn ngày khác hoặc tham khảo phòng còn trống nhé."
                          : dateAvailability?.available
                            ? selectedRoom.mode === "type" &&
                              dateAvailability.availableRooms !== undefined
                              ? `Còn ${dateAvailability.availableRooms} phòng trống trong khoảng ngày đã chọn.`
                              : "Phòng còn trống trong khoảng ngày đã chọn."
                            : "Chọn ngày để kiểm tra phòng trống."}
                    </div>
                  )}
                  {isRoomBlockedByStatus && (
                    <div className="room-unavailable-note">
                      Phòng này hiện không thể đặt. Vui lòng quay lại danh sách
                      phòng để chọn phòng còn trống.
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
