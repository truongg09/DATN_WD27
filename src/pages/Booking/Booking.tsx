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
import api from "../../services/api";
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

interface ExtraRoomSelection {
  id: number;
  roomTypeId: number;
  quantity: number;
  adults: number;
  children: number;
  childrenAges: (number | null)[];
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
  const [extraRoomTypes, setExtraRoomTypes] = useState<ExtraRoomSelection[]>(
    [],
  );
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
      guestName: user?.fullName || "",
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

  // Điền sẵn thông tin liên hệ của tài khoản đang đăng nhập.
  //
  // `user` chỉ là bản chụp lúc đăng nhập, nằm trong localStorage: khách sửa họ
  // tên hay số điện thoại ở trang Hồ sơ thì nó không đổi theo, và số điện thoại
  // chỉ lấy từ bảng accounts nên thường trống trong khi hồ sơ khách có đủ. Vì
  // vậy hỏi máy chủ lấy hồ sơ mới nhất, chỉ dùng bản chụp làm phương án dự phòng.
  useEffect(() => {
    if (!user) return;

    const snapshotName = user.fullName || "";
    const snapshotPhone = user.phone || "";
    setValue("guestName", snapshotName);
    setValue("guestEmail", user.email || "");
    setValue("guestPhone", snapshotPhone);

    if (!user.id) return;

    let cancelled = false;
    api
      .get(`/customers/by-account/${user.id}`)
      .then((response) => {
        if (cancelled) return;
        const res = response as { data?: Record<string, unknown> };
        const profile = (res.data?.data || res.data || res) as Record<string, unknown>;
        if (!profile) return;

        // Chỉ ghi đè khi máy chủ thật sự có dữ liệu, tránh xóa mất thông tin
        // khách đang gõ dở hoặc bản chụp đang dùng tạm.
        const fullName = String(profile.fullName || "").trim();
        const phone = String(profile.phone || "").trim();
        if (fullName) setValue("guestName", fullName);
        if (phone) setValue("guestPhone", phone);
      })
      .catch(() => {
        // Không lấy được hồ sơ thì giữ nguyên bản chụp, khách vẫn tự nhập được.
      });

    return () => {
      cancelled = true;
    };
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

  const handleAddExtraRoomType = () => {
    if (!selectedRoom) return;
    const usedIds = [
      selectedRoom.roomTypeId,
      ...extraRoomTypes.map((l) => l.roomTypeId),
    ];
    const firstFree = roomTypes.find((t) => !usedIds.includes(t.id));
    if (firstFree) {
      const extraAdultCap = Number(
        firstFree.adultCapacity ?? firstFree.capacity ?? 2,
      );
      setExtraRoomTypes((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          roomTypeId: firstFree.id,
          quantity: 1,
          adults: Math.max(1, extraAdultCap),
          children: 0,
          childrenAges: [],
        },
      ]);
    }
  };

  const updateExtraRoomType = (index: number, newTypeId: number) => {
    const newType = roomTypes.find((t) => t.id === newTypeId);
    const newAdultCap = Number(
      newType?.adultCapacity ?? newType?.capacity ?? 2,
    );
    setExtraRoomTypes((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              roomTypeId: newTypeId,
              adults: Math.max(1, newAdultCap),
            }
          : item,
      ),
    );
  };

  const updateExtraRoomQuantity = (index: number, qty: number) => {
    setExtraRoomTypes((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, qty) } : item,
      ),
    );
  };

  const updateExtraRoomAdults = (index: number, val: number) => {
    setExtraRoomTypes((prev) =>
      prev.map((item, i) => (i === index ? { ...item, adults: val } : item)),
    );
  };

  const updateExtraRoomChildren = (index: number, val: number) => {
    setExtraRoomTypes((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const currentAges = item.childrenAges;
        let nextAges = [...currentAges];
        if (val < currentAges.length) {
          nextAges = nextAges.slice(0, val);
        } else if (val > currentAges.length) {
          nextAges = [...nextAges, ...Array(val - nextAges.length).fill(null)];
        }
        return { ...item, children: val, childrenAges: nextAges };
      }),
    );
  };

  const updateExtraRoomChildAge = (
    roomIndex: number,
    childIndex: number,
    age: number | null,
  ) => {
    setExtraRoomTypes((prev) =>
      prev.map((item, i) => {
        if (i !== roomIndex) return item;
        const nextAges = [...item.childrenAges];
        nextAges[childIndex] = age;
        return { ...item, childrenAges: nextAges };
      }),
    );
  };

  const removeExtraRoom = (index: number) => {
    setExtraRoomTypes((prev) => prev.filter((_, i) => i !== index));
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
        const childCap = Number(
          roomType.childCapacity ?? (roomType.adultCapacity !== undefined ? 0 : 1),
        );
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
          beds: `${adultCap} người lớn + ${childCap} trẻ em (Tối đa ${maxOcc} khách)`,
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
        const childCap = Number(
          room.childCapacity ?? (room.adultCapacity !== undefined ? 0 : 1),
        );
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
          beds: `${adultCap} người lớn + ${childCap} trẻ em (Tối đa ${maxOcc} khách)`,
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
  const adultCap = Number(selectedRoom?.adultCapacity ?? selectedRoom?.capacity ?? 2);
  const childCap = Number(
    selectedRoom?.childCapacity ?? (selectedRoom?.adultCapacity !== undefined ? 0 : 1),
  );
  const maxOcc = Number(selectedRoom?.maxOccupancy ?? adultCap + childCap);
  const extraAdultFee = Number(selectedRoom?.extraAdultFee ?? 200000);
  const extraChildFee = Number(selectedRoom?.extraChildFee ?? 100000);

  const freeMaxAge =
    dateAvailability?.childrenPolicy?.freeMaxAge ??
    policies?.freeChildMaxAge ??
    5;

  const childMaxAge =
    dateAvailability?.childrenPolicy?.childMaxAge ??
    policies?.childMaxAge ??
    11;

  // Fix tự động tăng phòng: Tính sức chứa và khách của Room #1 (selectedRoom) riêng
  const room1Guests = adults + children;
  const room1Capacity = maxOcc * activeRoomQuantity;
  const room1MinRequiredRooms =
    maxOcc > 0 ? Math.max(1, Math.ceil(room1Guests / maxOcc)) : 1;
  const room1ExceedsCapacity = room1Guests > room1Capacity;

  const room1ValidChildrenAges = childrenAges.filter(
    (age): age is number => typeof age === "number" && age >= 0,
  );
  const room1AdultsFromChildren = room1ValidChildrenAges.filter(
    (age) => age > childMaxAge,
  ).length;
  const room1ChargeableChildrenCount = room1ValidChildrenAges.filter(
    (age) => age > freeMaxAge && age <= childMaxAge,
  ).length;

  const room1EffectiveAdults = adults + room1AdultsFromChildren;
  const room1EffectiveChildren = Math.max(
    0,
    children - room1AdultsFromChildren,
  );
  const room1StandardAdultCapacity = adultCap * activeRoomQuantity;
  const room1StandardChildCapacity = childCap * activeRoomQuantity;

  const room1ExtraAdults = Math.max(
    0,
    room1EffectiveAdults - room1StandardAdultCapacity,
  );
  const room1RawExtraChildren = Math.max(
    0,
    room1EffectiveChildren - room1StandardChildCapacity,
  );
  const room1ExtraChildren =
    room1ValidChildrenAges.length > 0
      ? Math.min(room1RawExtraChildren, room1ChargeableChildrenCount)
      : room1RawExtraChildren;

  const room1ExtraAdultAmount = room1ExtraAdults * extraAdultFee * nights;
  const room1ExtraChildAmount = room1ExtraChildren * extraChildFee * nights;

  // Tính toán chi tiết sức chứa và khách của từng hạng phòng đặt thêm (Room #2+)
  const extraRoomsBreakdown = extraRoomTypes.map((line) => {
    const type = roomTypes.find((t) => t.id === line.roomTypeId);
    const typeAdultCap = Number(type?.adultCapacity ?? type?.capacity ?? 2);
    const typeChildCap = Number(
      type?.childCapacity ?? (type?.adultCapacity !== undefined ? 0 : 1),
    );
    const typeMaxOcc = Number(
      type?.maxOccupancy ?? typeAdultCap + typeChildCap,
    );
    const typeExtraAdultFee = Number(type?.extraAdultFee ?? 200000);
    const typeExtraChildFee = Number(type?.extraChildFee ?? 100000);

    const lineGuests = line.adults + line.children;
    const lineCapacity = typeMaxOcc * line.quantity;
    const lineMinRequiredRooms =
      typeMaxOcc > 0 ? Math.max(1, Math.ceil(lineGuests / typeMaxOcc)) : 1;
    const lineExceedsCapacity = lineGuests > lineCapacity;

    const validAges = line.childrenAges.filter(
      (age): age is number => typeof age === "number" && age >= 0,
    );
    const adultsFromChild = validAges.filter((age) => age > childMaxAge).length;
    const chargeableChildCount = validAges.filter(
      (age) => age > freeMaxAge && age <= childMaxAge,
    ).length;

    const lineEffectiveAdults = line.adults + adultsFromChild;
    const lineEffectiveChildren = Math.max(
      0,
      line.children - adultsFromChild,
    );

    const standardAdultCap = typeAdultCap * line.quantity;
    const standardChildCap = typeChildCap * line.quantity;

    const lineExtraAdults = Math.max(
      0,
      lineEffectiveAdults - standardAdultCap,
    );
    const lineRawExtraChildren = Math.max(
      0,
      lineEffectiveChildren - standardChildCap,
    );
    const lineExtraChildren =
      validAges.length > 0
        ? Math.min(lineRawExtraChildren, chargeableChildCount)
        : lineRawExtraChildren;

    const lineExtraAdultAmount = lineExtraAdults * typeExtraAdultFee * nights;
    const lineExtraChildAmount = lineExtraChildren * typeExtraChildFee * nights;

    return {
      line,
      type,
      adultCap: typeAdultCap,
      childCap: typeChildCap,
      maxOcc: typeMaxOcc,
      extraAdultFee: typeExtraAdultFee,
      extraChildFee: typeExtraChildFee,
      guests: lineGuests,
      capacity: lineCapacity,
      minRequiredRooms: lineMinRequiredRooms,
      exceedsCapacity: lineExceedsCapacity,
      effectiveAdults: lineEffectiveAdults,
      effectiveChildren: lineEffectiveChildren,
      standardAdultCap,
      standardChildCap,
      extraAdults: lineExtraAdults,
      extraChildren: lineExtraChildren,
      extraAdultAmount: lineExtraAdultAmount,
      extraChildAmount: lineExtraChildAmount,
      totalExtraFee: lineExtraAdultAmount + lineExtraChildAmount,
    };
  });

  // Tổng hợp sức chứa & khách cho toàn bộ đơn đặt phòng
  const totalBookingAdults =
    adults + extraRoomTypes.reduce((sum, r) => sum + r.adults, 0);
  const totalBookingChildren =
    children + extraRoomTypes.reduce((sum, r) => sum + r.children, 0);

  const totalStandardAdultCapacity =
    room1StandardAdultCapacity +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.standardAdultCap, 0);

  const totalStandardChildCapacity =
    room1StandardChildCapacity +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.standardChildCap, 0);

  const totalMaxOccupancy =
    room1Capacity +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.capacity, 0);

  const effectiveAdults =
    room1EffectiveAdults +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.effectiveAdults, 0);

  const effectiveChildren =
    room1EffectiveChildren +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.effectiveChildren, 0);

  const totalGuests = effectiveAdults + effectiveChildren;

  const extraAdults =
    room1ExtraAdults +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.extraAdults, 0);

  const extraChildren =
    room1ExtraChildren +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.extraChildren, 0);

  const extraAdultAmount =
    room1ExtraAdultAmount +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.extraAdultAmount, 0);

  const extraChildAmount =
    room1ExtraChildAmount +
    extraRoomsBreakdown.reduce((sum, item) => sum + item.extraChildAmount, 0);

  const totalExtraGuestFee = extraAdultAmount + extraChildAmount;

  const allChildrenAges = [
    ...childrenAges,
    ...extraRoomTypes.flatMap((r) => r.childrenAges),
  ];
  const allValidChildrenAges = allChildrenAges.filter(
    (age): age is number => typeof age === "number" && age >= 0,
  );

  // Fix Item 6: Kiểm tra nếu chưa chọn đủ tuổi cho tất cả trẻ em của tất cả các phòng
  const hasUnselectedChildAge =
    (children > 0 &&
      (childrenAges.length < children ||
        childrenAges.some(
          (age) => age === null || age === undefined || age < 0,
        ))) ||
    extraRoomTypes.some(
      (r) =>
        r.children > 0 &&
        (r.childrenAges.length < r.children ||
          r.childrenAges.some(
            (age) => age === null || age === undefined || age < 0,
          )),
    );

  const availableRoomsCount =
    dateAvailability?.availableRooms ?? selectedRoom?.availableRooms;

  // Fix Item 3: Sửa max={availableRoomsCount || 20} để khi availableRoomsCount = 0 không bị fallback thành 20
  const maxSelectableRooms =
    availableRoomsCount !== undefined && availableRoomsCount !== null
      ? Math.max(1, availableRoomsCount)
      : 20;

  // Fix Item 4: Kiểm tra nếu room1MinRequiredRooms > availableRoomsCount (Hạng phòng không đủ phòng trống cho số khách)
  const isTypeNotEnoughForGuests =
    !isSpecificRoomMode &&
    availableRoomsCount !== undefined &&
    room1MinRequiredRooms > availableRoomsCount;

  const isUserSelectedMoreThanAvailable =
    !isSpecificRoomMode &&
    availableRoomsCount !== undefined &&
    activeRoomQuantity > availableRoomsCount;

  const isGuestExceedingMax =
    room1ExceedsCapacity ||
    extraRoomsBreakdown.some((r) => r.exceedsCapacity) ||
    totalGuests > totalMaxOccupancy;

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
          childrenAges: allValidChildrenAges,
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
  }, [selectedRoom, dateRange, childrenAges, extraRoomTypes]);

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
        `Hạng phòng ${selectedRoom?.name || ""} không đủ phòng cho số khách (${room1Guests} người cần ít nhất ${room1MinRequiredRooms} phòng, hiện chỉ còn ${availableRoomsCount} phòng trống).`,
      );
      return;
    }

    if (isGuestExceedingMax) {
      if (room1ExceedsCapacity) {
        message.error(
          `Số khách của ${selectedRoom?.name || "phòng đã chọn"} (${room1Guests} người) vượt quá sức chứa tối đa của ${activeRoomQuantity} phòng (${room1Capacity} người). Vui lòng chọn ít nhất ${room1MinRequiredRooms} phòng.`,
        );
      } else {
        const overLine = extraRoomsBreakdown.find((r) => r.exceedsCapacity);
        if (overLine) {
          message.error(
            `Số khách của ${overLine.type?.typeName || "hạng phòng đặt thêm"} (${overLine.guests} người) vượt quá sức chứa tối đa của ${overLine.line.quantity} phòng (${overLine.capacity} người). Vui lòng chọn ít nhất ${overLine.minRequiredRooms} phòng.`,
          );
        } else {
          message.error(
            `Tổng số khách (${totalGuests}) vượt quá sức chứa tối đa của ${totalSelectedRooms} phòng (${totalMaxOccupancy} người). Vui lòng chọn thêm phòng hoặc giảm số khách.`,
          );
        }
      }
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
            childrenAges: allValidChildrenAges,
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
        adults: totalBookingAdults,
        children: totalBookingChildren,
        childrenAges: allValidChildrenAges,
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
                  <h2>Thông tin phòng và khách</h2>
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

              {/* Danh sách các card chọn hạng phòng đồng bộ */}
              <div className="room-cards-list">
                {/* Phòng #1 (Hạng phòng chính) */}
                <div className="guest-configuration-card room-selection-card">
                  <div className="configuration-card-heading">
                    <div className="room-card-title-wrap">
                      <span className="room-card-title">Phòng #1</span>
                      <small className="room-card-subtitle">
                        {selectedRoom?.name ? `(${selectedRoom.name})` : ""}
                      </small>
                    </div>
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
                          label: `${type.typeName} — ${formatMoney(Number(type.defaultPrice || 0))}/đêm`,
                        }))}
                        onChange={(roomTypeId) => {
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
                        {room1MinRequiredRooms > 1 &&
                          activeRoomQuantity < room1MinRequiredRooms && (
                            <span className="suggested-q-tag">
                              Với số khách hiện tại, cần ít nhất {room1MinRequiredRooms} phòng.
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

                  <div className="form-row two-col guest-count-grid">
                    <div className="form-group">
                      <label>Người lớn</label>
                      <Select
                        value={adults}
                        onChange={(value) => setValue("adults", value)}
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
                            options={[
                              { value: 4, label: "Dưới 5 tuổi (Miễn phí)" },
                              { value: 8, label: "Từ 6 - 11 tuổi (Phụ thu trẻ em)" },
                              { value: 12, label: "Trên 12 tuổi (Tính người lớn)" },
                            ]}
                            size="large"
                            style={{ width: "100%" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Policy Box cho Phòng #1 */}
                  {selectedRoom && (
                    <div className="room-card-policy-box">
                      <div className="room-policy-item">
                        <span className="room-policy-label">Sức chứa tiêu chuẩn:</span>
                        <span className="room-policy-val">
                          {adultCap} người lớn + {childCap} trẻ em ({adultCap + childCap} khách)
                        </span>
                      </div>
                      <div className="room-policy-item">
                        <span className="room-policy-label">Sức chứa tối đa:</span>
                        <span className="room-policy-val">
                          {maxOcc} khách / phòng {maxOcc > adultCap + childCap ? `(tối đa ${maxOcc - (adultCap + childCap)} khách phát sinh)` : ''}
                        </span>
                      </div>
                      <div className="room-policy-item">
                        <span className="room-policy-label">Phụ thu khách phát sinh:</span>
                        <span className="room-policy-val">
                          Người lớn: {formatMoney(extraAdultFee)}/đêm · Trẻ em: {formatMoney(extraChildFee)}/đêm
                        </span>
                      </div>
                      {dateAvailability?.childrenPolicy ? (
                        <div className="room-policy-children-note">
                          * Trẻ em: 0–{dateAvailability.childrenPolicy.freeMaxAge} tuổi miễn phí · {dateAvailability.childrenPolicy.freeMaxAge + 1}–{dateAvailability.childrenPolicy.childMaxAge} tuổi phụ thu {formatMoney(dateAvailability.childrenPolicy.surchargePerNight)}/đêm · từ {dateAvailability.childrenPolicy.childMaxAge + 1} tuổi tính như người lớn.
                        </div>
                      ) : policies ? (
                        <div className="room-policy-children-note">
                          * Trẻ em: 0–{policies.freeChildMaxAge ?? 5} tuổi miễn phí · {(policies.freeChildMaxAge ?? 5) + 1}–{policies.childMaxAge ?? 11} tuổi phụ thu {formatMoney(extraChildFee)}/đêm · từ {(policies.childMaxAge ?? 11) + 1} tuổi tính như người lớn.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Các Phòng #2 trở đi */}
                {extraRoomTypes.map((line, index) => {
                  const usedIds = [
                    selectedRoom?.roomTypeId,
                    ...extraRoomTypes.filter((_, i) => i !== index).map((l) => l.roomTypeId),
                  ];
                  const currentType = roomTypes.find((t) => t.id === line.roomTypeId);
                  const currentAdultCap = Number(currentType?.adultCapacity ?? currentType?.capacity ?? 2);
                  const currentChildCap = Number(currentType?.childCapacity ?? 1);
                  const currentMaxOcc = Number(currentType?.maxOccupancy ?? (currentAdultCap + currentChildCap));
                  const currentExtraAdultFee = Number(currentType?.extraAdultFee ?? 200000);
                  const currentExtraChildFee = Number(currentType?.extraChildFee ?? 100000);

                  return (
                    <div className="guest-configuration-card room-selection-card" key={line.id}>
                      <div className="configuration-card-heading">
                        <div className="room-card-title-wrap">
                          <span className="room-card-title">Phòng #{index + 2}</span>
                          <small className="room-card-subtitle">
                            {currentType?.typeName ? `(${currentType.typeName})` : ""}
                          </small>
                        </div>
                        <Button
                          type="link"
                          danger
                          className="btn-remove-room-card"
                          onClick={() => removeExtraRoom(index)}
                        >
                          Xóa phòng
                        </Button>
                      </div>

                      <div className="form-row two-col room-selection-grid">
                        <div className="form-group">
                          <label>
                            Hạng phòng <span className="required">*</span>
                          </label>
                          <Select
                            value={line.roomTypeId}
                            placeholder="Chọn hạng phòng đặt thêm"
                            size="large"
                            style={{ width: "100%" }}
                            optionFilterProp="label"
                            onChange={(newTypeId) => updateExtraRoomType(index, newTypeId)}
                            options={roomTypes
                              .filter((t) => !usedIds.includes(t.id))
                              .map((t) => ({
                                value: t.id,
                                label: `${t.typeName} — ${formatMoney(Number(t.defaultPrice || 0))}/đêm`,
                              }))}
                          />
                        </div>

                        <div className="form-group room-quantity-field">
                          <label>
                            Số lượng phòng <span className="required">*</span>
                          </label>
                          <div className="room-quantity-row">
                            <button
                              type="button"
                              className="quantity-stepper-button"
                              aria-label="Giảm số lượng phòng"
                              disabled={line.quantity <= 1}
                              onClick={() => updateExtraRoomQuantity(index, line.quantity - 1)}
                            >
                              −
                            </button>
                            <InputNumber
                              min={1}
                              max={5}
                              value={line.quantity}
                              onChange={(value) =>
                                updateExtraRoomQuantity(index, Number(value || 1))
                              }
                              controls={false}
                              className="room-quantity-input"
                            />
                            <span className="room-quantity-unit">phòng</span>
                            <button
                              type="button"
                              className="quantity-stepper-button"
                              aria-label="Tăng số lượng phòng"
                              disabled={line.quantity >= 5}
                              onClick={() => updateExtraRoomQuantity(index, line.quantity + 1)}
                            >
                              +
                            </button>
                          </div>
                          {(() => {
                            const lineItem = extraRoomsBreakdown[index];
                            const lineMinRequired = lineItem?.minRequiredRooms ?? 1;
                            return (
                              lineMinRequired > 1 &&
                              line.quantity < lineMinRequired && (
                                <span className="suggested-q-tag">
                                  Với số khách hiện tại, cần ít nhất {lineMinRequired} phòng.
                                </span>
                              )
                            );
                          })()}
                        </div>
                      </div>

                      <div className="form-row two-col guest-count-grid">
                        <div className="form-group">
                          <label>Người lớn</label>
                          <Select
                            value={line.adults}
                            onChange={(val) => updateExtraRoomAdults(index, val)}
                            options={Array.from({ length: Math.max(5, line.adults) }, (_, i) => ({
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
                            value={line.children}
                            onChange={(val) => updateExtraRoomChildren(index, val)}
                            options={Array.from({ length: Math.max(5, line.children + 1) }, (_, i) => ({
                              value: i,
                              label: i === 0 ? "Không có trẻ em" : `${i} trẻ em`,
                            }))}
                            size="large"
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>

                      {line.children > 0 && (
                        <div className="child-age-grid">
                          {line.childrenAges.map((age, childIdx) => (
                            <div className="form-group" key={childIdx}>
                              <label>
                                Tuổi trẻ em {childIdx + 1}{" "}
                                <span className="required">*</span>
                              </label>
                              <Select
                                value={
                                  typeof age === "number" && age >= 0 ? age : undefined
                                }
                                placeholder="-- Chọn tuổi trẻ em --"
                                onChange={(value) =>
                                  updateExtraRoomChildAge(index, childIdx, value)
                                }
                                options={[
                                  { value: 4, label: "Dưới 5 tuổi (Miễn phí)" },
                                  { value: 8, label: "Từ 6 - 11 tuổi (Phụ thu trẻ em)" },
                                  { value: 12, label: "Trên 12 tuổi (Tính người lớn)" },
                                ]}
                                size="large"
                                style={{ width: "100%" }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Policy Box cho Phòng #2+ */}
                      {currentType && (
                        <div className="room-card-policy-box">
                          <div className="room-policy-item">
                            <span className="room-policy-label">Sức chứa tiêu chuẩn:</span>
                            <span className="room-policy-val">
                              {currentAdultCap} người lớn + {currentChildCap} trẻ em ({currentAdultCap + currentChildCap} khách)
                            </span>
                          </div>
                          <div className="room-policy-item">
                            <span className="room-policy-label">Sức chứa tối đa:</span>
                            <span className="room-policy-val">
                              {currentMaxOcc} khách / phòng {currentMaxOcc > currentAdultCap + currentChildCap ? `(tối đa ${currentMaxOcc - (currentAdultCap + currentChildCap)} khách phát sinh)` : ''}
                            </span>
                          </div>
                          <div className="room-policy-item">
                            <span className="room-policy-label">Phụ thu khách phát sinh:</span>
                            <span className="room-policy-val">
                              Người lớn: {formatMoney(currentExtraAdultFee)}/đêm · Trẻ em: {formatMoney(currentExtraChildFee)}/đêm
                            </span>
                          </div>
                          {dateAvailability?.childrenPolicy ? (
                            <div className="room-policy-children-note">
                              * Trẻ em: 0–{dateAvailability.childrenPolicy.freeMaxAge} tuổi miễn phí · {dateAvailability.childrenPolicy.freeMaxAge + 1}–{dateAvailability.childrenPolicy.childMaxAge} tuổi phụ thu {formatMoney(dateAvailability.childrenPolicy.surchargePerNight)}/đêm · từ {dateAvailability.childrenPolicy.childMaxAge + 1} tuổi tính như người lớn.
                            </div>
                          ) : policies ? (
                            <div className="room-policy-children-note">
                              * Trẻ em: 0–{policies.freeChildMaxAge ?? 5} tuổi miễn phí · {(policies.freeChildMaxAge ?? 5) + 1}–{policies.childMaxAge ?? 11} tuổi phụ thu {formatMoney(currentExtraChildFee)}/đêm · từ {(policies.childMaxAge ?? 11) + 1} tuổi tính như người lớn.
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Nút thêm hạng phòng */}
                {!isSpecificRoomMode && selectedRoom && roomTypes.length > extraRoomTypes.length + 1 && (
                  <div className="add-room-type-btn-wrap">
                    <Button
                      type="dashed"
                      block
                      size="large"
                      className="btn-add-room-type"
                      onClick={handleAddExtraRoomType}
                    >
                      + Thêm hạng phòng khác
                    </Button>
                  </div>
                )}

                {extraRoomTypes.length > 0 && (
                  <div className="extra-rooms-stay-note">
                    {nights > 0 ? (
                      <span>
                        Tạm tính các hạng đặt thêm: <strong>{formatMoney(extraRoomsAmount)}</strong> cho {nights} đêm.
                        Giá ngày lễ và cuối tuần sẽ được hệ thống tính tự động khi xác nhận.
                      </span>
                    ) : (
                      <span>Chọn ngày nhận và trả phòng để xem tạm tính cho các hạng đặt thêm.</span>
                    )}
                  </div>
                )}
              </div>

              {/* Cảnh báo giá các đêm lễ / cuối tuần (chỉ liệt kê các ngày tăng giá) */}
              {dateAvailability?.nightlyPrices && (dateAvailability.nightlyPrices as any[]).some((n: any) => n.isHoliday || n.isSunday || n.isSaturday || n.price > Number(selectedRoom?.price || 0)) && (() => {
                const specialNights = (dateAvailability.nightlyPrices as any[]).filter(
                  (n: any) => n.isHoliday || n.isSunday || n.isSaturday || n.price > Number(selectedRoom?.price || 0)
                );
                if (specialNights.length === 0) return null;

                return (
                  <div style={{ margin: '18px 30px 0', padding: '14px 16px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d46b08', fontWeight: 600, fontSize: 14 }}>
                      <span>⚠️ Các đêm áp dụng phụ thu Cuối tuần (+10%) / Dịp lễ (+20%)</span>
                    </div>
                    <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#595959' }}>
                      Chi tiết đơn giá các đêm tăng giá trong khoảng thời gian lưu trú:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {specialNights.map((night: any, idx: number) => {
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
                              {night.isHoliday && <Tag color="red" style={{ marginLeft: 6 }}>Ngày lễ (+20%)</Tag>}
                              {night.isSunday && <Tag color="orange" style={{ marginLeft: 6 }}>Chủ nhật (+10%)</Tag>}
                              {night.isSaturday && <Tag color="purple" style={{ marginLeft: 6 }}>Thứ 7 (+10%)</Tag>}
                              {night.note && <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 4 }}>({night.note})</span>}
                            </span>
                            <span style={{ fontWeight: 600, color: '#cf1322' }}>
                              {formatMoney(night.price)} / phòng
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Alert kiểm tra sức chứa */}
              <div className="capacity-alert-wrapper" style={{ margin: '18px 30px 24px' }}>
                {isTypeNotEnoughForGuests ? (
                  <div className="capacity-alert-box danger">
                    <strong>Hạng phòng không đủ phòng trống!</strong>
                    <p>
                      Số khách của {selectedRoom?.name || "phòng"} ({room1Guests} người) cần ít nhất{" "}
                      {room1MinRequiredRooms} phòng, nhưng hạng phòng này hiện chỉ
                      còn {availableRoomsCount} phòng trống. Vui lòng giảm số
                      khách hoặc chọn hạng phòng khác.
                    </p>
                  </div>
                ) : isGuestExceedingMax ? (
                  <div className="capacity-alert-box danger">
                    <strong>Vượt quá sức chứa tối đa!</strong>
                    <p>
                      Tổng {totalGuests} khách ({effectiveAdults} người lớn +{" "}
                      {effectiveChildren} trẻ em) vượt quá sức chứa tối đa của{" "}
                      {totalSelectedRooms} phòng ({totalMaxOccupancy} người).
                      Vui lòng chọn thêm phòng hoặc giảm số khách.
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

            {/* Section 3: Dịch vụ bổ sung */}
            <div className="booking-section services-section">
              <h2>Dịch vụ bổ sung</h2>
              <div className="form-group">
                <label>Dịch vụ của phòng (tùy chọn)</label>

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

            {/* Section 4: Tùy chọn thời gian */}
            <div className="booking-section time-options-section">
              <h2>Tùy chọn thời gian</h2>
              <p className="section-subtitle-note">
                Không bắt buộc · Lễ tân sẽ chuẩn bị phòng theo giờ bạn chọn; giờ trả chỉ nhận đến giờ chuẩn.
              </p>
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
            </div>

            {/* Section 5: Yêu cầu đặc biệt */}
            <div className="booking-section special-requests-section">
              <h2>Yêu cầu đặc biệt</h2>
              <div className="form-group">
                <label>Ghi chú (tùy chọn)</label>
                <Controller
                  name="specialRequests"
                  control={control}
                  render={({ field }) => (
                    <TextArea
                      {...field}
                      placeholder="Nhập các yêu cầu đặc biệt như: phòng tầng cao, giường phụ, thú cưng, dị ứng..."
                      rows={4}
                    />
                  )}
                />
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

                  {extraRoomTypes.map((line) => {
                    const type = roomTypes.find(
                      (roomType) => roomType.id === line.roomTypeId,
                    );
                    if (!type) return null;

                    const typeAdultCapacity = Number(
                      type.adultCapacity ?? type.capacity ?? 2,
                    );
                    const typeChildCapacity = Number(
                      type.childCapacity ?? (type.adultCapacity !== undefined ? 0 : 1),
                    );
                    const typeMaxOccupancy = Number(
                      type.maxOccupancy ??
                        typeAdultCapacity + typeChildCapacity,
                    );

                    return (
                      <div
                        className="selected-room selected-extra-room"
                        key={line.id}
                      >
                        <img
                          src={getRoomTypeCardImage(type.typeName)}
                          alt={type.typeName}
                          onError={(event) =>
                            handleRoomImageError(event, type.typeName)
                          }
                        />
                        <div className="room-summary-info">
                          <div className="room-summary-heading">
                            <h4>{type.typeName}</h4>
                          </div>
                          <p className="room-summary-meta">
                            {line.quantity} phòng đã chọn
                          </p>
                          <p>
                            <FontAwesomeIcon icon={faBed} /> Sức chứa:{" "}
                            {typeAdultCapacity} người lớn + {typeChildCapacity} trẻ em (Tối đa {typeMaxOccupancy} khách)
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  <div className="capacity-preview-box">
                    <span className="capacity-preview-title">Sức chứa</span>
                    <div className="capacity-spec-row">
                      <span className="spec-label">Tiêu chuẩn:</span>
                      <span className="spec-val">
                        {totalStandardAdultCapacity} người lớn + {totalStandardChildCapacity} trẻ em
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
                        {effectiveAdults} người lớn + {effectiveChildren} trẻ em
                      </span>
                    </div>
                    {(extraAdults > 0 || extraChildren > 0) && (
                      <div className="capacity-spec-row extra">
                        <span className="spec-label">Phát sinh</span>
                        <span className="spec-val highlight">
                          {extraAdults} người lớn + {extraChildren} trẻ em
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
                            {extraRoomTypes.length === 0 && (
                              <small>
                                {extraAdults} × {formatMoney(extraAdultFee)} × {nights} đêm
                              </small>
                            )}
                            <strong>= {formatMoney(extraAdultAmount)}</strong>
                          </div>
                        )}
                        {extraChildren > 0 && (
                          <div className="extra-fee-item">
                            <span>{extraChildren} trẻ em</span>
                            {extraRoomTypes.length === 0 && (
                              <small>
                                {extraChildren} × {formatMoney(extraChildFee)} × {nights} đêm
                              </small>
                            )}
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
                      <span>{totalSelectedRooms} phòng</span>
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

                      const nightlyList = (dateAvailability?.nightlyPrices as any[]) || [];
                      const holidayNights = nightlyList.filter((n: any) => n.isHoliday);
                      const weekendNights = nightlyList.filter((n: any) => !n.isHoliday && (n.isSaturday || n.isSunday));

                      const holidaySurchargeTotal = holidayNights.length > 0
                        ? holidayNights.reduce((sum: number, n: any) => sum + (Number(n.surcharge) || 0), 0) * activeRoomQuantity
                        : 0;
                      const weekendSurchargeTotal = weekendNights.length > 0
                        ? weekendNights.reduce((sum: number, n: any) => sum + (Number(n.surcharge) || 0), 0) * activeRoomQuantity
                        : 0;
                      const otherSurcharge = Math.max(0, actualStayRoomTotal - baseStandardRoomTotal - holidaySurchargeTotal - weekendSurchargeTotal);

                      const holidayNames = Array.from(new Set(holidayNights.map((n: any) => n.holidayName || n.note).filter(Boolean)));

                      return (
                        <>
                          <div className="summary-row">
                            <span>Tiền phòng tiêu chuẩn ({activeRoomQuantity} phòng)</span>
                            <span>{formatPrice(baseStandardRoomTotal)}</span>
                          </div>
                          {holidaySurchargeTotal > 0 && (
                            <div className="summary-row extra-row" style={{ color: '#cf1322', fontWeight: 600 }}>
                              <span>Phụ thu Ngày lễ ({holidayNames.length > 0 ? holidayNames.join(', ') : '+20%'})</span>
                              <span>+{formatPrice(holidaySurchargeTotal)}</span>
                            </div>
                          )}
                          {weekendSurchargeTotal > 0 && (
                            <div className="summary-row extra-row" style={{ color: '#d46b08', fontWeight: 600 }}>
                              <span>Phụ thu Cuối tuần (Thứ 7 / CN - +10%)</span>
                              <span>+{formatPrice(weekendSurchargeTotal)}</span>
                            </div>
                          )}
                          {otherSurcharge > 0 && (
                            <div className="summary-row extra-row" style={{ color: '#cf1322', fontWeight: 600 }}>
                              <span>Phụ thu ngày đặc biệt</span>
                              <span>+{formatPrice(otherSurcharge)}</span>
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
