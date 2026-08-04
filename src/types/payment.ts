export type PaymentMethod = "cash" | "zalopay" | "vnpay" | "bank_transfer";

export type PaymentStatus = "unpaid" | "deposit_paid" | "paid" | "refunded";

export interface Payment {
    id: number;
    bookingId: number;
    roomAmount: number;
    serviceAmount: number;
    surchargeAmount: number;
    discountAmount: number;
    depositAmount: number;
    paidAmount: number;
    remainingAmount: number;
    totalAmount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    transactionCode?: string;
    paymentDate?: string;
    verificationStatus?: "pending" | "confirmed" | "rejected";
    verificationAmount?: number;
    verificationSubmittedAt?: string;
    /** Booking lifecycle: pending, confirmed, checked_in, checked_out, cancelled. */
    bookingStatus?: string;
    customerName?: string;
    roomNumber?: string;
}
