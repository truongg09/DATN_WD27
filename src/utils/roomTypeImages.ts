// Ảnh local cho từng hạng phòng (dùng chung cho trang tìm kiếm, chi tiết, trang chủ).
// Ảnh backend (room_images) chỉ được ưu tiên khi là URL http(s) đầy đủ.

const asset = (path: string) =>
  new URL(`../assets/rooms/${path}`, import.meta.url).href;

const GALLERIES: Array<{ match: (name: string) => boolean; images: string[] }> = [
  {
    match: (name) => name.includes('deluxe'),
    images: ['deluxe/deluxe1.jpg', 'deluxe/deluxe3.jpg', 'deluxe/deluxe4.jpg'].map(asset),
  },
  {
    match: (name) => name.includes('family'),
    images: ['family/family1.jpg', 'family/family2.jpg', 'family/family4.jpg'].map(asset),
  },
  {
    match: (name) =>
      name.includes('suite') || name.includes('president') || name.includes('luxury') || name.includes('bungalow'),
    images: ['luxury/luxury1.jpg', 'luxury/luxury2.jpg', 'luxury/luxury3.jpg'].map(asset),
  },
  {
    match: (name) => name.includes('superior'),
    images: ['standard/standard3.jpg', 'standard/standard4.jpg', 'standard/standard2.jpg'].map(asset),
  },
  {
    // standard và mặc định
    match: () => true,
    images: ['standard/standard1.jpg', 'standard/standard2.jpg', 'standard/standard3.jpg'].map(asset),
  },
];

const EXTRA_IMAGES = ['bathroom/bathroom1.jpg', 'bathroom/bathroom2.jpg', 'balcony-view/balcony1.jpg'].map(asset);

const isRemoteUrl = (url: string) => url.startsWith('http://') || url.startsWith('https://');

/** Gallery đầy đủ cho trang chi tiết hạng phòng (ưu tiên ảnh backend nếu là URL http). */
export const getRoomTypeGallery = (typeName: string, backendImages?: string[]): string[] => {
  if (backendImages && backendImages.length > 0 && isRemoteUrl(backendImages[0])) {
    return backendImages;
  }
  const name = (typeName || '').toLowerCase();
  const gallery = GALLERIES.find((entry) => entry.match(name))!;
  return [...gallery.images, ...EXTRA_IMAGES];
};

/** Ảnh đại diện cho card hạng phòng. */
export const getRoomTypeCardImage = (typeName: string, backendImages?: string[]): string =>
  getRoomTypeGallery(typeName, backendImages)[0];
