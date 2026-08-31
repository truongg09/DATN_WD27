import api from "./api";

export interface RoomTypeAmenity {
  name: string;
  icon: string;
}

export interface RoomTypeReview {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  customerName: string;
}

// Kết quả của GET /rooms/types/search và /rooms/types/:id
export interface RoomTypeSearchResult {
  id: number;
  typeName: string;
  description: string | null;
  capacity: number;
  adultCapacity?: number;
  childCapacity?: number;
  maxOccupancy?: number;
  extraAdultFee?: number;
  extraChildFee?: number;
  defaultPrice: number;
  totalRooms: number;
  minArea: number | null;
  maxArea: number | null;
  images: string[];
  amenities: RoomTypeAmenity[];
  avgRating: number | null;
  reviewCount: number;
  fitsGuests?: boolean;
  fitsOneRoom?: boolean;
  minimumRooms?: number;
  // Chỉ có khi truyền checkIn/checkOut
  availableRooms?: number;
  nights?: number;
  stayAmount?: number;
  nightlyPrices?: Array<{ date: string; price: number }>;
  reviews?: RoomTypeReview[];
}

export interface RoomTypeSearchParams {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
}

export const getRooms = async () => {
  return api.get("/rooms");
};

export const searchRoomTypes = async (params?: RoomTypeSearchParams) => {
  return api.get("/rooms/types/search", { params });
};

export const getRoomTypeDetail = async (
  id: number,
  params?: Pick<RoomTypeSearchParams, "checkIn" | "checkOut">
) => {
  return api.get(`/rooms/types/${id}`, { params });
};

export const getRoomById = async (id: number) => {
  return api.get(`/rooms/${id}`);
};

export const getRoomTypes = async () => {
  return api.get("/rooms/types");
};

export const createRoom = async (data: Record<string, unknown>) => {
  return api.post("/rooms", data);
};

export const updateRoom = async (
  id: number,
  data: Record<string, unknown>
) => {
  return api.put(`/rooms/${id}`, data);
};

export interface NightlyPriceItem {
  date: string;
  stayDate?: string;
  price: number;
  // Máy chủ luôn trả kèm hai trường này (xem calcNightlyPrices) nhưng kiểu cũ
  // khai thiếu, nên nơi nào muốn tách phần phụ thu ra đều bị TypeScript chặn.
  basePrice?: number;
  surcharge?: number;
  priceType?: 'normal' | 'weekend' | 'sunday' | 'holiday' | 'season' | 'special';
  note?: string | null;
  dayOfWeek?: number;
  dayName?: string;
  isHoliday?: boolean;
  isSunday?: boolean;
  isSaturday?: boolean;
  isWeekend?: boolean;
  roomId?: number | null;
  roomNumber?: string | null;
}

export interface RoomPriceRule {
  id: number;
  roomTypeId: number | null;
  roomTypeName?: string;
  roomTypeDefaultPrice?: number;
  startDate: string;
  endDate: string;
  price: number;
  priceType: 'normal' | 'weekend' | 'sunday' | 'holiday' | 'season' | 'special';
  note?: string | null;
}

// Interceptor ở services/api.ts trả thẳng phần body, nên kiểu trả về của hai
// hàm dưới đây khai theo body chứ không phải AxiosResponse. Khai sai khiến nơi
// gọi viết res.data.data và luôn nhận undefined mà TypeScript không báo.
export const getRoomPrices = async (params?: { roomTypeId?: number; priceType?: string }) => {
  return api.get('/rooms/prices', { params }) as unknown as Promise<{
    data: RoomPriceRule[];
  }>;
};

export const createRoomPrice = async (data: Partial<RoomPriceRule>) => {
  return api.post<{ data: RoomPriceRule; message: string }>('/rooms/prices', data);
};

export const updateRoomPrice = async (id: number, data: Partial<RoomPriceRule>) => {
  return api.put<{ data: RoomPriceRule; message: string }>(`/rooms/prices/${id}`, data);
};

export const deleteRoomPrice = async (id: number) => {
  return api.delete<{ message: string }>(`/rooms/prices/${id}`);
};

export const previewRoomPrice = async (params: {
  roomTypeId?: number;
  checkIn: string;
  checkOut: string;
  fallbackPrice?: number;
}) => {
  return api.get('/rooms/price-preview', { params }) as unknown as Promise<{
    data: {
      nights: number;
      prices: NightlyPriceItem[];
      total: number;
    };
  }>;
};