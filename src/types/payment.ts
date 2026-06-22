export type PaymentMethod = "cash" | "momo" | "vnpay";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

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
}