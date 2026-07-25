export interface Customer {
    id: number;
    accountId: number;
    fullName: string;
    phone: string;
    gender: "male" | "female" | "other";  
    dateOfBirth?: string;
    citizenId?: string;
    nationality?: string;
    address?: string;
}

export interface RoomImage {
    id: number;
    roomTypeId: number;
    imageUrl: string;
}

export interface Room {
    id: number;
    roomTypeId: number;
    roomNumber: string;
    floor: number;
    area: number;
    status: "available" | "booked" | "maintenance";
}

export interface RoomPrice {
    id: number;
    roomTypeId: number;
    startDate: string;
    endDate: string;
    price: number;
    priceType: "normal" | "weekend" | "holiday";
}