import api from './api';
import { unwrapList } from '../utils/unwrapList';
import type { Service } from '../types/service';

const SERVICE_TRANSLATIONS: Record<string, Pick<Service, 'serviceName' | 'description'>> = {
  breakfast: {
    serviceName: 'Buffet sáng',
    description: 'Buffet sáng phục vụ từ 06:30 đến 10:00.',
  },
  laundry: {
    serviceName: 'Giặt ủi',
    description: 'Dịch vụ giặt và ủi quần áo.',
  },
  spa: {
    serviceName: 'Spa thư giãn',
    description: 'Dịch vụ chăm sóc và thư giãn tại spa.',
  },
  'airport pickup': {
    serviceName: 'Đưa đón sân bay',
    description: 'Xe đưa đón giữa khách sạn và sân bay.',
  },
  'room service': {
    serviceName: 'Phục vụ tại phòng',
    description: 'Phục vụ đồ ăn và thức uống tại phòng.',
  },
  'dinner buffet': {
    serviceName: 'Buffet tối',
    description: 'Buffet tối phục vụ từ 18:00 đến 21:30.',
  },
  massage: {
    serviceName: 'Massage thư giãn',
    description: 'Dịch vụ massage thư giãn.',
  },
  'bicycle rental': {
    serviceName: 'Thuê xe đạp',
    description: 'Thuê xe đạp sử dụng trong ngày.',
  },
  'mini bar': {
    serviceName: 'Đồ uống minibar',
    description: 'Đồ ăn nhẹ và nước uống trong minibar.',
  },
  'extra bed': {
    serviceName: 'Kê thêm giường',
    description: 'Tối đa 1 giường phụ mỗi phòng; đăng ký trước 18:00 ngày nhận phòng.',
  },
};

export const localizeService = (service: Service): Service => {
  const translation = SERVICE_TRANSLATIONS[service.serviceName.trim().toLocaleLowerCase('en')];
  return translation ? { ...service, ...translation } : service;
};

export const getServices = async (): Promise<Service[]> => {
  const response = await api.get('/services');
  return unwrapList<Service>(response).map(localizeService);
};
