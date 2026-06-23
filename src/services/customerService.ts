import api from './api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

type ListParams = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
};

export const fetchCustomers = async (params: ListParams) => {
  const url = new URL(`${API_BASE}/customers`);
  url.searchParams.set('page', String(params.page));
  url.searchParams.set('limit', String(params.limit));
  if (params.search) url.searchParams.set('search', params.search);
  url.searchParams.set('status', params.status || 'all');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const fetchCustomerDetail = async (id: number) => {
  const res = await fetch(`${API_BASE}/customers/detail?id=${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const fetchCustomerBookings = async (
  id: number,
  page: number,
  limit: number
) => {
  const res = await fetch(
    `${API_BASE}/customers/bookings?id=${id}&page=${page}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const fetchCustomerPayments = async (id: number) => {
  const res = await fetch(`${API_BASE}/customers/payments?id=${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const fetchCustomerReviews = async (id: number) => {
  const res = await fetch(`${API_BASE}/customers/reviews?id=${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const createCustomer = async (body: Record<string, unknown>) => {
  const res = await fetch(`${API_BASE}/customers/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

export const updateCustomer = async (body: Record<string, unknown>) => {
  const res = await fetch(`${API_BASE}/customers/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

export const deleteCustomer = async (id: number) => {
  const res = await fetch(`${API_BASE}/customers/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

export const lockCustomer = async (id: number, reason: string) => {
  const res = await fetch(`${API_BASE}/customers/lock?id=${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
};

export const getCustomers = async () => api.get('/customers');

export const getCustomerById = async (id: number) => api.get(`/customers/${id}`);
