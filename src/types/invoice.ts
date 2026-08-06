export type InvoiceStatus = "draft" | "issued" | "cancelled";

export interface InvoiceServiceItem {
  serviceId: number;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

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
  stayRoomAmount?: number;
  roomAmount: number;
  serviceAmount: number;
  services?: InvoiceServiceItem[];
  surchargeAmount: number;
  occupancySurcharge?: number;
  childrenCount?: number;
  discountAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  createdAt: string;
}
