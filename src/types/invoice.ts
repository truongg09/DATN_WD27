export type InvoiceStatus = "draft" | "issued" | "cancelled";

export interface InvoiceServiceItem {
  serviceId: number;
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceDamageItem {
  id: number;
  chargeType: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  roomNumber?: string;
  note?: string;
  createdAt?: string;
}

export interface InvoiceLateChargeItem {
  id: number;
  name: string;
  lateMinutes: number;
  tierPercent: number;
  nightlyRate: number;
  totalPrice: number;
  note?: string;
  createdAt?: string;
}

export interface InvoiceTransfer {
  id: number;
  fromRoomId: number;
  fromRoomNumber?: string;
  toRoomId: number;
  toRoomNumber?: string;
  fromDate: string;
  toDate: string;
  pricePerNight: number;
  reason?: string;
  createdAt?: string;
}

export interface InvoiceNightlyPrice {
  id?: number;
  stayDate: string;
  dayName?: string;
  price: number;
  basePrice?: number;
  surcharge?: number;
  priceType: string;
  isHoliday?: boolean;
  isSunday?: boolean;
  isSaturday?: boolean;
  isWeekend?: boolean;
  note?: string;
  roomId?: number;
  roomNumber?: string;
}

export interface InvoiceBreakdown {
  basePricePerNight: number;
  totalNights: number;
  baseRoomAmount: number;
  holidaySurcharge: number;
  sundaySurcharge: number;
  weekendSurcharge: number;
  occupancySurcharge: number;
  damageAmount: number;
  lateCheckoutSurcharge?: number;
  serviceAmount: number;
  discountAmount: number;
  roomAmount: number;
  surchargeAmount: number;
  totalAmount: number;
}

export interface InvoiceRoom {
  bookingDetailId?: number | null;
  roomId?: number | null;
  roomNumber: string;
  roomTypeId?: number | null;
  typeName: string;
  roomTypeName?: string;
  roomPrice: number;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
  occupancySurcharge?: number;
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
  rooms?: InvoiceRoom[];
  services?: InvoiceServiceItem[];
  damages?: InvoiceDamageItem[];
  lateCharges?: InvoiceLateChargeItem[];
  transfers?: InvoiceTransfer[];
  nightlyPrices?: InvoiceNightlyPrice[];
  breakdown?: InvoiceBreakdown;
  surchargeAmount: number;
  occupancySurcharge?: number;
  childrenCount?: number;
  discountAmount: number;
  depositAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  totalAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  createdAt: string;
}

