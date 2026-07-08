import api from "./api";

export interface RefundRow {
  id: number;
  paymentId: number;
  bookingId: number;
  amount: number | string;
  refundRate: number | string;
  paidAmount: number | string;
  refundMethod: "cash" | "bank_transfer";
  bankBin?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  status: "pending" | "approved" | "rejected";
  note?: string | null;
  createdAt: string;
  processedAt?: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  room_number?: string;
}

export const listRefunds = async (params?: { status?: string; bookingId?: number }) => {
  return api.get("/refunds", { params }) as Promise<{ data: RefundRow[] }>;
};

export const getMyRefunds = async () => {
  return api.get("/refunds/me") as Promise<{ data: RefundRow[] }>;
};

export const approveRefund = async (id: number, note?: string) => {
  return api.patch(`/refunds/${id}/approve`, { note });
};

export const rejectRefund = async (id: number, note?: string) => {
  return api.patch(`/refunds/${id}/reject`, { note });
};
