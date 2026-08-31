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

export interface EarlyCheckInPolicy {
  tier1Hours: number;
  tier1Percent: number;
  tier2Hours: number;
  tier2Percent: number;
  tier3Hours: number;
  tier3Percent: number;
}

export interface PoliciesInfo {
  checkInTime: string;
  checkOutTime: string;
  nearTierMaxDays: number;
  nearTierPercent: number;
  midTierMaxDays: number;
  midTierPercent: number;
  farTierPercent: number;
  freeChildMaxAge?: number;
  childMaxAge?: number;
  earlyTier1Hours?: number;
  earlyTier1Percent?: number;
  earlyTier2Hours?: number;
  earlyTier2Percent?: number;
  earlyTier3Hours?: number;
  earlyTier3Percent?: number;
  earlyCheckInPolicy?: EarlyCheckInPolicy;
}

export const getPolicies = async () => {
  return api.get('/settings/policies') as Promise<{ data: PoliciesInfo }>;
};

export const updatePolicies = async (data: Partial<PoliciesInfo>) => {
  return api.put('/settings/policies', data) as Promise<{ data: PoliciesInfo; message?: string }>;
};

export interface LateCheckoutTiersInfo {
  id?: number;
  graceMinutes: number;
  tier1MaxHours: number;
  tier1Percent: number;
  tier2MaxHours: number;
  tier2Percent: number;
  tier3Percent: number;
  standardCheckOutTime: string;
  standardCheckInTime: string;
  housekeepingBufferMinutes: number;
  absoluteMaxLateHours: number;
  earlyTier1Hours?: number;
  earlyTier1Percent?: number;
  earlyTier2Hours?: number;
  earlyTier2Percent?: number;
  earlyTier3Hours?: number;
  earlyTier3Percent?: number;
  earlyCheckInPolicy?: EarlyCheckInPolicy;
}

export const getLateCheckoutTiers = async () => {
  return api.get('/settings/late-checkout-tiers') as Promise<{ data: LateCheckoutTiersInfo }>;
};

export const updateLateCheckoutTiers = async (data: LateCheckoutTiersInfo) => {
  return api.put('/settings/late-checkout-tiers', data) as Promise<{ data: LateCheckoutTiersInfo; message?: string }>;
};