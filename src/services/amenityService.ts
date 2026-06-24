import api from './api';

export interface Amenity {
  id: number;
  name: string;
  icon: string;
  description: string;
}

export const getAmenities = async (): Promise<Amenity[]> => {
  const response = await api.get('/amenities');
  return response.data;
};
