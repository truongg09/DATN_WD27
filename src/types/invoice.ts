export type InvoiceStatus = "draft" | "issued" | "cancelled";

export interface Invoice {
  id: number;
  invoiceNumber: string;
  bookingId: number;
  paymentId?: number;
  userId: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  roomNumber: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  roomAmount: number;
  serviceAmount: number;
  discountAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  createdAt: string;
}
