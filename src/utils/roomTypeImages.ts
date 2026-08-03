// Ảnh local cho từng hạng phòng (dùng chung cho trang tìm kiếm, chi tiết, trang chủ).
// Ảnh backend (room_images) chỉ được ưu tiên khi là URL http(s) đầy đủ.

// Eager-load toàn bộ ảnh phòng thành map { đường-dẫn: url }.
// Đây là cách chuẩn của Vite cho asset động có thư mục con - chạy đúng ở cả dev lẫn build.
// (new URL(`...${bien}`) không khớp được file trong thư mục con nên gây vỡ ảnh.)
const roomImageModules = import.meta.glob('../assets/rooms/**/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const asset = (path: string): string =>
  roomImageModules[`../assets/rooms/${path}`] ?? '';

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

/** Ảnh mặc định khi một ảnh nào đó tải lỗi (404/hỏng). */
export const DEFAULT_ROOM_IMAGE = asset('standard/standard1.jpg');

/**
 * Gắn vào <img onError={...}> để ảnh lỗi tự thay bằng ảnh phòng mặc định,
 * không bao giờ hiện icon ảnh vỡ. Ưu tiên ảnh đúng hạng phòng nếu biết typeName.
 */
export const handleRoomImageError = (
  event: { currentTarget: HTMLImageElement },
  typeName?: string
) => {
  const img = event.currentTarget;
  const fallback = typeName ? getRoomTypeCardImage(typeName) : DEFAULT_ROOM_IMAGE;
  if (img.src !== fallback && !img.dataset.fallbackApplied) {
    img.dataset.fallbackApplied = 'true';
    img.src = fallback;
  }
};
