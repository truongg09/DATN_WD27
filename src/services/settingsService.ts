import api from "./api";

export interface PaymentSettings {
  bankBin: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferPrefix: string;
}

export const getPaymentSettings = async () => {
  return api.get("/settings/payment") as Promise<{ data: PaymentSettings }>;
};

export const updatePaymentSettings = async (data: PaymentSettings) => {
  return api.put("/settings/payment", data) as Promise<{ data: PaymentSettings; message?: string }>;
};
