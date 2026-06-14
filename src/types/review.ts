export interface Review {
    id: number;
    bookingId: number;
    customerId: number;
    rating: number;
    comment: string;
    createdAt: string;
}