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

export const processPayment = async (
  id: number,
  data: { paymentMethod: PaymentMethod; amount?: number }
) => {
  return api.post(`/payments/${id}/pay`, data) as Promise<
    ApiResponse<{
      payment: Payment;
      invoice?: import("../types/invoice").Invoice;
      redirectUrl?: string | null;
    }>
  >;
};

export const refundPayment = async (id: number) => {
  return api.patch(`/payments/${id}/refund`) as Promise<ApiResponse<Payment>>;
};
