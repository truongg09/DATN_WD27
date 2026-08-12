import type { RoomTypeSummaryItem } from '../utils/bookingUtils';

export type InvoiceStatus = "draft" | "issued" | "cancelled";

export interface InvoiceServiceItem {
  serviceId: number;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceRoomItem {
  bookingDetailId?: number;
  id: number;
  number: string;
  roomTypeId?: number;
  typeName?: string;
  roomPrice?: number;
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
  roomQuantity?: number;
  roomTypesSummary?: RoomTypeSummaryItem[];
  booking_rooms?: InvoiceRoomItem[];
  checkIn: string;
  checkOut: string;
  stayRoomAmount?: number;
  roomAmount: number;
  serviceAmount: number;
  services?: InvoiceServiceItem[];
  surchargeAmount: number;
  occupancySurcharge?: number;
  lateCheckoutSurcharge?: number;
  damageAmount?: number;
  damages?: Array<{
    id: number;
    roomId?: number;
    roomNumber?: string;
    chargeType?: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    note?: string;
  }>;
  childrenCount?: number;
  discountAmount: number;
  depositAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  totalAmount: number;
  status: InvoiceStatus;
  paymentStatus?: string;
  paymentMethod?: string;
  issuedAt: string;
  createdAt: string;
}
