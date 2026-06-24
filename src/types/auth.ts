export type UserRole =
  | "admin"
  | "staff"
  | "customer"
  | string;


export interface User {
  id: number;
  customerId?: number;
  email: string;
  phone?: string;
  fullName?: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}