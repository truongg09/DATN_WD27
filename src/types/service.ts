export interface Service {
    id: number;
    serviceName: string;
    description: string;
    price: number;
}

export interface BookingService {
    id: number;
    bookingId: number;
    serviceId: number;
    quantity: number;
    totalPrice: number;
}