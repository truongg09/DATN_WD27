import api from "./api";

export const getCustomers = async () => {
  return api.get("/customers");
};

export const getCustomerById = async (
  id: number
) => {
  return api.get(`/customers/${id}`);
};