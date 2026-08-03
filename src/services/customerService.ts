import api from './api';

type ListParams = {
  page: number;
  limit: number;
  search?: string;
  status?: string;
};

// Mọi lời gọi đều đi qua instance axios chung để interceptor tự gắn
// Authorization: Bearer <token>. Trước đây các hàm này dùng fetch() thô nên
// không kèm token và sẽ hỏng ngay khi backend bật xác thực.
/* eslint-disable @typescript-eslint/no-explicit-any */
type ApiResult = { ok?: boolean; error?: string; [key: string]: any };

const unwrap = async (promise: Promise<unknown>): Promise<any> => {
  try {
    const json = (await promise) as ApiResult;
    if (json && json.ok === false) {
      throw new Error(json.error || 'Thao tác không thành công');
    }
    return json;
  } catch (error) {
    const response = (error as { response?: { data?: { error?: string; message?: string } } }).response;
    const messageFromServer = response?.data?.error || response?.data?.message;
    throw new Error(messageFromServer || (error as Error).message, { cause: error });
  }
};

export const fetchCustomers = async (params: ListParams) =>
  unwrap(
    api.get('/customers', {
      params: {
        page: params.page,
        limit: params.limit,
        ...(params.search ? { search: params.search } : {}),
        status: params.status || 'all'
      }
    })
  );

export const fetchCustomerDetail = async (id: number) =>
  unwrap(api.get('/customers/detail', { params: { id } }));

export const fetchCustomerBookings = async (id: number, page: number, limit: number) =>
  unwrap(api.get('/customers/bookings', { params: { id, page, limit } }));

export const fetchCustomerPayments = async (id: number) =>
  unwrap(api.get('/customers/payments', { params: { id } }));

export const fetchCustomerReviews = async (id: number) =>
  unwrap(api.get('/customers/reviews', { params: { id } }));

export const createCustomer = async (body: Record<string, unknown>) =>
  unwrap(api.post('/customers/create', body));

export const updateCustomer = async (body: Record<string, unknown>) =>
  unwrap(api.post('/customers/update', body));

export const deleteCustomer = async (id: number) =>
  unwrap(api.post('/customers/delete', { id }));

export const lockCustomer = async (id: number, reason: string) =>
  unwrap(api.post('/customers/lock', { reason }, { params: { id } }));

export const getCustomers = async () => api.get('/customers');

export const getCustomerById = async (id: number) => api.get(`/customers/${id}`);
