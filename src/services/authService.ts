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

export const getProfile = async () => {
  return api.get("/auth/profile");
};

export interface ForgotPasswordResponse {
  message: string;
  delivered?: boolean;
  token?: string;
}

export const forgotPasswordRequest = async (email: string): Promise<ForgotPasswordResponse> => {
  const response = await api.post<ForgotPasswordResponse>("/auth/forgot-password", { email });
  return response.data;
};

export const resetPassword = async (token: string, password: string): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>("/auth/reset-password", { token, password });
  return response.data;
};
