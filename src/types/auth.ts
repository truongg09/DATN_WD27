export type UserRole =
  | "admin"
  | "staff"
  | "customer";

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}