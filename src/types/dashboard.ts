export interface DashboardSummary {
    totalBookings: number;
    totalRevenue: number;  
    totalCustomers: number;
    totalRooms: number;
}

export interface RevenueChart {
    month: string;
    revenue: number;
}