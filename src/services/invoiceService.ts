import api from "./api";
import type { Invoice } from "../types/invoice";

interface ApiResponse<T> {
  data: T;
  message?: string;
}

export const getInvoices = async (params?: {
  userId?: number;
  bookingId?: number;
  status?: string;
}) => {
  return api.get("/invoices", { params }) as Promise<ApiResponse<Invoice[]>>;
};

export const getInvoiceById = async (id: number) => {
  return api.get(`/invoices/${id}`) as Promise<ApiResponse<Invoice>>;
};

export const getInvoiceByBookingId = async (bookingId: number) => {
  return api.get(`/invoices/booking/${bookingId}`) as Promise<ApiResponse<Invoice>>;
};
