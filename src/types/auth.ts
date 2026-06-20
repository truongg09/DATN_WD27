export type UserRole =
  | "admin"
  | "staff"
  | "customer"
  | string;


export interface User {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}