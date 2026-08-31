export const formatPrice = (price: string | number | null | undefined) => {
  const numPrice = typeof price === 'number' ? price : parseFloat(price ?? '') || 0;
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(numPrice) + ' VNĐ';
};

export const ROOM_ITEM_STATUS: Record<string, { label: string; color: string }> = {
  normal: { label: 'Bình thường', color: 'green' },
  damaged: { label: 'Hư hỏng', color: 'red' },
  lost: { label: 'Bị mất', color: 'volcano' },
  maintenance: { label: 'Đang bảo trì', color: 'orange' },
};

export const ROOM_ITEM_STATUS_OPTIONS = Object.entries(ROOM_ITEM_STATUS).map(
  ([value, { label }]) => ({ value, label })
);
