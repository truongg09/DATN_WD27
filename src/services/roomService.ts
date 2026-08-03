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
  defaultPrice: number;
  totalRooms: number;
  minArea: number | null;
  maxArea: number | null;
  images: string[];
  amenities: RoomTypeAmenity[];
  avgRating: number | null;
  reviewCount: number;
  fitsGuests?: boolean;
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

export const deleteRoom = async (
  id: number
) => {
  return api.delete(`/rooms/${id}`);
};
