import api from "./api";

export const getEmployees = async () => {
  return api.get("/employees");
};

export const createEmployee = async (
  data: any
) => {
  return api.post("/employees", data);
};