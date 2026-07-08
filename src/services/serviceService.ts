import api from './api';
import { unwrapList } from '../utils/unwrapList';
import type { Service } from '../types/service';

export const getServices = async (): Promise<Service[]> => {
  const response = await api.get('/services');
  return unwrapList<Service>(response);
};
