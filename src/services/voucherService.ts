import api from "./api";

export interface CustomerVoucher {
  id: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscount: number | null;
  minBookingAmount: number | null;
  startDate: string;
  endDate: string;
  status: "active";
  grantedSource: string | null;
  isPersonal: number | boolean;
  roomTypeNames: string | null;
}

export interface EligibleCustomer {
  userId: number;
  fullName: string;
  email: string;
  phone: string;
}

export interface AssignedCustomer {
  customerVoucherId: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  isUsed: number;
  source: string;
  bookingId: number | null;
}

export interface AdminVoucher {
  id: number;
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  minBookingAmount: number | null;
  quantity: number;
  startDate: string;
  endDate: string;
  status: string;
  roomTypeIds?: string | null;
  roomTypeNames?: string | null;
  targetType?: "all" | "specific" | "no_show";
  customerCount?: number;
  customerIds?: number[];
  assignedCustomers?: AssignedCustomer[];
  unusedCount?: number;
  usedCount?: number;
}

export const getMyVouchers = async () => {
  return api.get("/vouchers/me") as Promise<{ data: CustomerVoucher[] }>;
};

export const getVouchers = async () => {
  return api.get("/vouchers") as Promise<{ data: AdminVoucher[] }>;
};

export const getEligibleCustomers = async () => {
  return api.get("/vouchers/eligible-customers") as Promise<{ data: EligibleCustomer[] }>;
};

export const createVoucher = async (
  data: Record<string, unknown>
) => {
  return api.post("/vouchers", data);
};

export const updateVoucher = async (id: number, data: Record<string, unknown>) => {
  return api.put(`/vouchers/${id}`, data);
};

export const deleteVoucher = async (id: number) => {
  return api.delete(`/vouchers/${id}`);
};