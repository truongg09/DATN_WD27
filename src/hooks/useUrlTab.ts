import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Giữ tab / chế độ xem đang mở trên URL để F5 hay gửi link cho người khác vẫn
 * vào đúng chỗ, thay vì luôn rơi về tab đầu tiên.
 *
 * Giá trị lạ (người dùng sửa tay trên thanh địa chỉ, hoặc tab cũ đã bị gỡ) được
 * bỏ qua và trả về tab mặc định — không để giao diện trắng vì key không khớp.
 *
 * Dùng replace thay vì push: đổi tab không phải là "đi tới trang mới", nếu đẩy
 * vào history thì bấm Back sẽ phải lùi qua từng tab đã bấm mới thoát được trang.
 *
 * @param paramName tên tham số trên URL, ví dụ "tab" hoặc "view"
 * @param validTabs danh sách key hợp lệ
 * @param defaultTab key dùng khi URL chưa có gì; key này được giữ ngầm định
 *                   (không ghi lên URL) cho địa chỉ trang gọn
 */
export function useUrlTab<T extends string>(
  paramName: string,
  validTabs: readonly T[],
  defaultTab: T
): [T, (next: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get(paramName);
  const active = (validTabs as readonly string[]).includes(raw ?? "")
    ? (raw as T)
    : defaultTab;

  // Nhận string để cắm thẳng vào Tabs.onChange của Ant Design (chữ ký của nó là
  // (activeKey: string) => void), key lạ thì bỏ qua thay vì ghi rác lên URL.
  const setActive = useCallback(
    (next: string) => {
      if (!(validTabs as readonly string[]).includes(next)) return;

      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === defaultTab) {
            params.delete(paramName);
          } else {
            params.set(paramName, next);
          }
          return params;
        },
        { replace: true }
      );
    },
    [paramName, defaultTab, validTabs, setSearchParams]
  );

  return [active, setActive];
}
