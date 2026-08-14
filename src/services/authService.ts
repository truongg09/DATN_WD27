import api from "./api";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  dob?: string;
  gender?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: {
    id: number;
    email: string;
    phone: string;
    fullName?: string;
    role: string;
  };
}

export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  return api.post("/auth/login", data);
};

export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  return api.post("/auth/register", data);
};

