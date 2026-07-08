export interface Voucher {
    id: number;
    code: string;
    discountType: "percent" | "fixed";
    discountValue: number;
    maxDiscount?: number;
    minBookingAmount?: number;
    quantity: number;
    startDate: string;
    endDate: string;
    status: "active" | "inactive";
}