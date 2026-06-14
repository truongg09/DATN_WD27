import api from "./api";

export const getRooms = async () => {
  return api.get("/rooms");
};

export const getRoomById = async (id: number) => {
  return api.get(`/rooms/${id}`);
};

export const createRoom = async (data: any) => {
  return api.post("/rooms", data);
};

export const updateRoom = async (
  id: number,
  data: any
) => {
  return api.put(`/rooms/${id}`, data);
};

export const deleteRoom = async (
  id: number
) => {
  return api.delete(`/rooms/${id}`);
};