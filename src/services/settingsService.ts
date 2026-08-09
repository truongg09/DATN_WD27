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

export interface PoliciesInfo {
  checkInTime: string;
  checkOutTime: string;
  nearTierMaxDays: number;
  nearTierPercent: number;
  midTierMaxDays: number;
  midTierPercent: number;
  farTierPercent: number;
}

export const getPolicies = async () => {
  return api.get('/settings/policies') as Promise<{ data: PoliciesInfo }>;
};