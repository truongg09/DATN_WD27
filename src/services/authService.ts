import api from "./api";

export const login = async (data: {
  email: string;
  password: string;
}) => {
  return api.post("/auth/login", data);
};

export const register = async (data: any) => {
  return api.post("/auth/register", data);
};

export const getProfile = async () => {
  return api.get("/auth/profile");
};