import axios from "axios";
import { Modal } from "antd";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipMutationConfirm?: boolean;
  }

  export interface InternalAxiosRequestConfig {
    skipMutationConfirm?: boolean;
  }
}

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);
const READ_ONLY_POST_PATTERNS = [
  /\/check-availability(?:\?|$)/,
  /\/check-type-availability(?:\?|$)/,
  /\/admin-check-availability(?:\?|$)/,
  /\/admin-preview-modify(?:\?|$)/,
  /\/preview-voucher(?:\?|$)/,
];

// Popconfirm/Modal.confirm đã xác nhận ở component thì request phát sinh ngay
// sau đó không cần hỏi lần hai. Một lần xác nhận có thể bao gồm vài request
// thuộc cùng thao tác (ví dụ cập nhật vật tư rồi thêm phí hư hại).
let componentConfirmValidUntil = 0;

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const confirmedButton = target.closest(
      ".ant-popconfirm-buttons .ant-btn-primary, .ant-modal-confirm-btns .ant-btn-primary"
    );
    if (confirmedButton) {
      componentConfirmValidUntil = Date.now() + 2500;
    }
  }, true);
}

const isAdminOrStaffArea = () =>
  typeof window !== "undefined"
  && (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/staff"));

const needsMutationConfirm = (method: string, url: string, skip?: boolean) => {
  if (skip || !isAdminOrStaffArea() || !MUTATION_METHODS.has(method)) return false;
  if (READ_ONLY_POST_PATTERNS.some((pattern) => pattern.test(url))) return false;
  if (Date.now() <= componentConfirmValidUntil) return false;
  return true;
};

const mutationDescription = (method: string) => {
  if (method === "delete") return "Dữ liệu sẽ bị xóa hoặc ngừng hiển thị sau khi xác nhận.";
  if (method === "post") return "Hệ thống sẽ tạo mới hoặc thực hiện nghiệp vụ này.";
  return "Hệ thống sẽ lưu các thay đổi vào dữ liệu hiện tại.";
};

const confirmMutation = (method: string) => new Promise<void>((resolve, reject) => {
  Modal.confirm({
    title: "Xác nhận thay đổi dữ liệu",
    content: mutationDescription(method),
    okText: method === "delete" ? "Xóa" : "Xác nhận",
    cancelText: "Hủy",
    okButtonProps: method === "delete" ? { danger: true } : undefined,
    onOk: () => resolve(),
    onCancel: () => reject(new axios.CanceledError("Người dùng đã hủy thao tác")),
  });
});

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor
api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const method = String(config.method || "get").toLowerCase();
    const url = String(config.url || "");
    if (needsMutationConfirm(method, url, config.skipMutationConfirm)) {
      await confirmMutation(method);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
api.interceptors.response.use(
  (response) => response.data,

  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");

      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
