export type Status =
  | "active"
  | "inactive"
  | "banned";

export type Role =
  | "admin"
  | "staff"
  | "customer";

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}