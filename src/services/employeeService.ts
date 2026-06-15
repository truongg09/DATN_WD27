import api from "./api";

export const getEmployees = async () => {
  return api.get("/employees");
};

export const createEmployee = async (
  data: Record<string, unknown>
) => {
  return api.post("/employees", data);
};