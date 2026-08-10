export interface RoomType {
    id: number;
    typeName: string; 
    description: string;
    capacity: number;
    adultCapacity?: number;
    childCapacity?: number;
    maxOccupancy?: number;
    extraAdultFee?: number;
    extraChildFee?: number;
    defaultPrice: number;
}