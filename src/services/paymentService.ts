import api from "./api";
import type { Payment, PaymentMethod } from "../types/payment";

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export const createPayment = async (data: {
  bookingId: number;
  serviceAmount?: number;
  discountAmount?: number;
  depositAmount?: number;
  paymentMethod?: PaymentMethod;
}) => {
  return api.post("/payments", data) as Promise<ApiResponse<Payment>>;
};

export const getPayments = async (params?: {
  bookingId?: number;
  paymentStatus?: string;
}) => {
  return api.get("/payments", { params }) as Promise<ApiResponse<Payment[]>>;
};

export const getPaymentById = async (id: number) => {
  return api.get(`/payments/${id}`) as Promise<ApiResponse<Payment>>;
};

export const getPaymentByBookingId = async (bookingId: number) => {
  return api.get(`/payments/booking/${bookingId}`) as Promise<ApiResponse<Payment>>;
};

export interface VoucherPreview {
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number;
  minBookingAmount: number;
  validUntil: string;
  roomTypes: string[];
  subtotal: number;
  paidAmount: number;
  discountAmount: number;
  rawDiscount: number;
  cappedByMaxDiscount: boolean;
  cappedByPayable: boolean;
  totalAfterDiscount: number;
  remainingAfterDiscount: number;
}

export const previewVoucher = async (id: number, code: string) => {
  return api.post(`/payments/${id}/preview-voucher`, { code }) as Promise<
    ApiResponse<VoucherPreview>
  >;
};

/** Gỡ voucher đang áp để lễ tân/khách chọn lại mã khác. */
export const removeVoucher = async (id: number) => {
  return api.delete(`/payments/${id}/voucher`) as Promise<
    ApiResponse<{ payment: Payment; removedVoucher: { id: number; code: string | null } }>
  >;
};

export const applyVoucher = async (id: number, code: string) => {
  return api.post(`/payments/${id}/apply-voucher`, { code }) as Promise<
    ApiResponse<{
      payment: Payment;
      voucher: { id: number; code: string; discountAmount: number };
    }>
  >;
};

export const processPayment = async (
  id: number,
  data: { paymentMethod: PaymentMethod; amount?: number; sandbox?: boolean }
) => {
  return api.post(`/payments/${id}/pay`, data) as Promise<
    ApiResponse<{
      payment: Payment;
      invoice?: import("../types/invoice").Invoice;
      redirectUrl?: string | null;
    }>
  >;
};

export interface WalletPaymentResult {
  payment: Payment;
  invoice?: import("../types/invoice").Invoice | null;
  wallet: {
    transactionId: number;
    debitedAmount: number;
    balanceBefore: number;
    balanceAfter: number;
  };
  idempotent?: boolean;
}

export const payWithWallet = async (
  id: number,
  data: { amount: number; idempotencyKey: string }
) => {
  return api.post(`/payments/${id}/pay-wallet`, data, {
    // Trang khách tự hiển thị hộp xác nhận với đầy đủ số dư trước/sau.
    skipMutationConfirm: true,
  }) as Promise<ApiResponse<WalletPaymentResult>>;
};

export const createGatewayOrder = async (
  id: number,
  data: {
    paymentMethod: Extract<PaymentMethod, "zalopay" | "vnpay">;
    amount: number;
    returnContext?: "admin_bookings" | "staff_bookings";
  }
) => {
  return api.post(`/payments/${id}/gateway-order`, data) as Promise<
    ApiResponse<{ orderId: string; paymentUrl: string; expiresAt: string }>
  >;
};

export const submitTransferConfirmation = async (
  id: number,
  data: { paymentMethod: "bank_transfer"; amount: number }
) => {
  return api.post(`/payments/${id}/transfer-confirmation`, data) as Promise<ApiResponse<Payment>>;
};

export const confirmTransferPayment = async (id: number) => {
  return api.post(`/payments/${id}/confirm-transfer`) as Promise<ApiResponse<Payment>>;
};

export const refundPayment = async (id: number) => {
  return api.patch(`/payments/${id}/refund`) as Promise<ApiResponse<Payment>>;
};

export const confirmPayment = async (
  id: number,
  data: { amount: number; transactionCode: string; gatewayOrderId?: string }
) => {
  return api.post(`/payments/${id}/confirm`, data) as Promise<
    ApiResponse<{
      payment: Payment;
      invoice?: import("../types/invoice").Invoice;
    }>
  >;
};