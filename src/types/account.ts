import { Role, Status } from "./common";

export interface Account {
  id: number;
  email: string;
  role: Role;
  status: Status;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  account: Account;
}