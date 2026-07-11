import api from "./api";

export interface WalletBalance {
  credited: number;
  pendingWithdraw: number;
  available: number;
}

export interface WalletTransaction {
  id: number;
  customerId: number;
  refundId?: number | null;
  bookingId?: number | null;
  type: "refund_credit" | "withdrawal";
  amount: number | string;
  status: "pending" | "approved" | "rejected";
  refundMethod?: "cash" | "bank_transfer" | null;
  bankBin?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  note?: string | null;
  createdAt: string;
  processedAt?: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

export const getMyWallet = async () => {
  return api.get("/wallet/me") as Promise<{
    data: { balance: WalletBalance; transactions: WalletTransaction[] };
  }>;
};

export const requestWithdraw = async (data: {
  amount: number;
  refundMethod: "cash" | "bank_transfer";
  bankBin?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}) => {
  return api.post("/wallet/withdraw", data);
};

export const listWithdrawals = async (params?: { status?: string }) => {
  return api.get("/wallet/withdrawals", { params }) as Promise<{ data: WalletTransaction[] }>;
};

export const approveWithdrawal = async (id: number, note?: string) => {
  return api.patch(`/wallet/withdrawals/${id}/approve`, { note });
};

export const rejectWithdrawal = async (id: number, note?: string) => {
  return api.patch(`/wallet/withdrawals/${id}/reject`, { note });
};
