"use client";

export type HealthCheckLogRow = {
  id: string;
  account_id: string;
  premium_account_id: string;
  service_type_id: string;
  check_timestamp: string;
  check_type: "api" | "manual" | "scheduled";
  current_status: "working" | "error" | "unknown";
  previous_status: string | null;
  notes: string | null;
  response_time_ms?: number | null;
  created_at: string;
  updated_at: string;
  premium_accounts: {
    id: string;
    primary_email: string;
    status: string;
    connection_status: string | null;
  } | null;
};

export type PremiumAccountOption = {
  id: string;
  primary_email: string;
  status: string;
  connection_status: string | null;
};

export type PremiumServiceOption = {
  id: string;
  name: string;
  category: string;
  is_active: boolean;
};

export type HealthCheckPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary?: {
    workingCount: number;
    errorCount: number;
    unknownCount: number;
    manualCount: number;
  };
};

export type HealthCheckRunResponse = {
  checked: number;
  failed: number;
  results: Array<{
    premium_account_id: string;
    email: string;
    status: "working" | "error" | "unknown";
    log_id: string;
    previous_status: string | null;
  }>;
  errors?: Array<{
    premium_account_id: string;
    error: string;
  }>;
};
