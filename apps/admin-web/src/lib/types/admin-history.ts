export type AuditActorFilter = string | "system" | "all";

export interface AdminHistoryQuery {
  page?: number;
  limit?: number;
  mode?: string | null;
  createdBy?: AuditActorFilter | null;
  fromDate?: string | null;
  toDate?: string | null;
}

export interface AdminHistoryMeta {
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}
