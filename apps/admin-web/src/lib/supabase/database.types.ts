// ============================================
// DATABASE TYPES  auto-kept in sync with actual schema
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          account_id: string;
          full_name: string;
          type: "retail" | "wholesale" | "agency";
          phone: string | null;
          email: string | null;
          group_id: string | null;
          notes: string | null;
          nicks_registry: Record<string, unknown>[] | null;
          debt_amount_vnd: number;
          debt_overdue_days: number;
          reliability_score: number;
          segment: string | null;
          rfm_score: number | null;
          rfm_recency: number | null;
          rfm_frequency: number | null;
          rfm_monetary: number | null;
          last_rfm_calculated_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          full_name: string;
          type?: "retail" | "wholesale" | "agency";
          phone?: string | null;
          email?: string | null;
          group_id?: string | null;
          notes?: string | null;
          nicks_registry?: Record<string, unknown>[] | null;
          debt_amount_vnd?: number;
          debt_overdue_days?: number;
          reliability_score?: number;
          segment?: string | null;
          rfm_score?: number | null;
          rfm_recency?: number | null;
          rfm_frequency?: number | null;
          rfm_monetary?: number | null;
          last_rfm_calculated_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          full_name?: string;
          type?: "retail" | "wholesale" | "agency";
          phone?: string | null;
          email?: string | null;
          group_id?: string | null;
          notes?: string | null;
          nicks_registry?: Record<string, unknown>[] | null;
          debt_amount_vnd?: number;
          debt_overdue_days?: number;
          reliability_score?: number;
          segment?: string | null;
          rfm_score?: number | null;
          rfm_recency?: number | null;
          rfm_frequency?: number | null;
          rfm_monetary?: number | null;
          last_rfm_calculated_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_product_prices_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_product_prices_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_product_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };
      customer_contacts: {
        Row: {
          id: string;
          customer_id: string;
          channel: "phone" | "email" | "zalo" | "facebook" | "telegram" | "other";
          value: string;
          is_verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          channel: "phone" | "email" | "zalo" | "facebook" | "telegram" | "other";
          value: string;
          is_verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          channel?: "phone" | "email" | "zalo" | "facebook" | "telegram" | "other";
          value?: string;
          is_verified?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          }
        ];
      };
      reminder_config: {
        Row: {
          id: string;
          account_id: string;
          t7_enabled: boolean;
          t3_enabled: boolean;
          t1_enabled: boolean;
          channel: "telegram" | "zalo" | "email" | "both";
          template_renewal: string;
          template_debt: string;
          template_renewal_internal: string;
          template_renewal_zalo: string;
          template_expired_zalo: string;
          auto_send: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          t7_enabled?: boolean;
          t3_enabled?: boolean;
          t1_enabled?: boolean;
          channel?: "telegram" | "zalo" | "email" | "both";
          template_renewal?: string;
          template_debt?: string;
          template_renewal_internal?: string;
          template_renewal_zalo?: string;
          template_expired_zalo?: string;
          auto_send?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          t7_enabled?: boolean;
          t3_enabled?: boolean;
          t1_enabled?: boolean;
          channel?: "telegram" | "zalo" | "email" | "both";
          template_renewal?: string;
          template_debt?: string;
          template_renewal_internal?: string;
          template_renewal_zalo?: string;
          template_expired_zalo?: string;
          auto_send?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_config_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_user_contacts: {
        Row: {
          id: string;
          account_id: string;
          channel: "telegram" | "zalo";
          external_user_id: string;
          chat_id: string | null;
          display_name: string | null;
          username: string | null;
          phone: string | null;
          customer_id: string | null;
          auto_reminder_enabled: boolean;
          last_interaction_at: string | null;
          last_message_text: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          channel: "telegram" | "zalo";
          external_user_id: string;
          chat_id?: string | null;
          display_name?: string | null;
          username?: string | null;
          phone?: string | null;
          customer_id?: string | null;
          auto_reminder_enabled?: boolean;
          last_interaction_at?: string | null;
          last_message_text?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          channel?: "telegram" | "zalo";
          external_user_id?: string;
          chat_id?: string | null;
          display_name?: string | null;
          username?: string | null;
          phone?: string | null;
          customer_id?: string | null;
          auto_reminder_enabled?: boolean;
          last_interaction_at?: string | null;
          last_message_text?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_user_contacts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bot_user_contacts_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_sessions: {
        Row: {
          id: string;
          zalo_user_id: string;
          mode: "ai" | "human";
          paused_by: string | null;
          paused_at: string | null;
          customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zalo_user_id: string;
          mode: "ai" | "human";
          paused_by?: string | null;
          paused_at?: string | null;
          customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          zalo_user_id?: string;
          mode?: "ai" | "human";
          paused_by?: string | null;
          paused_at?: string | null;
          customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_sessions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_error_logs: {
        Row: {
          id: string;
          account_id: string;
          customer_id: string | null;
          zalo_user_id: string;
          error_type: string;
          description: string;
          status: string;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          customer_id?: string | null;
          zalo_user_id: string;
          error_type: string;
          description: string;
          status?: string;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          customer_id?: string | null;
          zalo_user_id?: string;
          error_type?: string;
          description?: string;
          status?: string;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_error_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      providers: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          contacts: Record<string, unknown>[] | null;
          tier: "regular" | "vip";
          reliability_score: number;
          contact_email: string | null;
          notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          contacts?: Record<string, unknown>[] | null;
          tier?: "regular" | "vip";
          reliability_score?: number;
          contact_email?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          contacts?: Record<string, unknown>[] | null;
          tier?: "regular" | "vip";
          reliability_score?: number;
          contact_email?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_provider_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["provider_id"];
          },
          {
            foreignKeyName: "provider_product_prices_provider_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "provider_product_prices";
            referencedColumns: ["provider_id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          mode: "slot" | "key" | "hybrid";
          duration_type: "days" | "months" | "years";
          duration_value: number;
          buy_price_vnd: number;
          sell_price_vnd: number;
          price_vnd: number | null;
          cost_vnd: number | null;
          description: string | null;
          is_active: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          mode: "slot" | "key" | "hybrid";
          duration_type?: "days" | "months" | "years";
          duration_value?: number;
          buy_price_vnd: number;
          sell_price_vnd: number;
          price_vnd?: number | null;
          cost_vnd?: number | null;
          description?: string | null;
          is_active?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          mode?: "slot" | "key" | "hybrid";
          duration_type?: "days" | "months" | "years";
          duration_value?: number;
          buy_price_vnd?: number;
          sell_price_vnd?: number;
          price_vnd?: number | null;
          cost_vnd?: number | null;
          description?: string | null;
          is_active?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "license_keys_product_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "license_keys";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "provider_product_prices_product_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "provider_product_prices";
            referencedColumns: ["product_id"];
          },
        ];
      };
      orders: {
        Row: {
          id: string;
          account_id: string;
          /** Human-readable order code (e.g. DMH_A1B2C3). */
          order_code: string | null;
          customer_id: string;
          /** Primary product (first item). Null for orders with multiple distinct products. */
          product_id: string | null;
          /** Total quantity across ALL line items. */
          quantity: number;
          /** Unit price of the primary product. Null for multi-product orders — see order_items. */
          unit_price_vnd: number | null;
          /** Product name frozen at purchase time (primary product). */
          product_name_snapshot: string | null;
          /** Cost price of the primary product. Null for multi-product orders. */
          cost_price_vnd: number | null;
          /** Sum of (cost_price_vnd × quantity) across all order_items — FROZEN at creation. */
          total_cost_vnd: number | null;
          /** Sum of (price_vnd × quantity) across all order_items — FROZEN at creation. */
          total_amount_vnd: number;
          total_paid: number;
          payment_method: string | null;
          payment_terms: "prepaid" | "credit" | "cod" | null;
          payment_source_id: string | null;
          sales_channel_id: string | null;
          status: "draft" | "pending_payment" | "paid" | "provisioning" | "active" | "expired" | "refunded";
          contact_snapshot: string | null;
          proof_image_urls: string[] | null;
          sales_note: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          expires_at: string;
          invoice_snapshot: Record<string, unknown> | null;
          billing_details: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          order_code?: string | null;
          customer_id: string;
          product_id?: string | null;
          quantity: number;
          unit_price_vnd?: number | null;
          product_name_snapshot?: string | null;
          cost_price_vnd?: number | null;
          total_cost_vnd?: number | null;
          total_amount_vnd: number;
          total_paid?: number;
          payment_method?: string | null;
          payment_terms?: "prepaid" | "credit" | "cod" | null;
          payment_source_id?: string | null;
          sales_channel_id?: string | null;
          status?: "draft" | "pending_payment" | "paid" | "provisioning" | "active" | "expired" | "refunded";
          contact_snapshot?: string | null;
          proof_image_urls?: string[] | null;
          sales_note?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          expires_at: string;
          invoice_snapshot?: Record<string, unknown> | null;
          billing_details?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          order_code?: string | null;
          customer_id?: string;
          product_id?: string | null;
          quantity?: number;
          unit_price_vnd?: number | null;
          product_name_snapshot?: string | null;
          cost_price_vnd?: number | null;
          total_cost_vnd?: number | null;
          total_amount_vnd?: number;
          total_paid?: number;
          payment_method?: string | null;
          payment_terms?: "prepaid" | "credit" | "cod" | null;
          payment_source_id?: string | null;
          sales_channel_id?: string | null;
          status?: "draft" | "pending_payment" | "paid" | "provisioning" | "active" | "expired" | "refunded";
          contact_snapshot?: string | null;
          proof_image_urls?: string[] | null;
          sales_note?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
          invoice_snapshot?: Record<string, unknown> | null;
          billing_details?: Record<string, unknown> | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_payment_source_id_fkey";
            columns: ["payment_source_id"];
            isOneToOne: false;
            referencedRelation: "payment_sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_sales_channel_id_fkey";
            columns: ["sales_channel_id"];
            isOneToOne: false;
            referencedRelation: "sales_channels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "order_status_history";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "refund_requests_order_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "refund_requests";
            referencedColumns: ["order_id"];
          }
        ];
      };
      source_accounts: {
        Row: {
          id: string;
          account_id: string;
          email: string;
          provider: string;
          max_slots: number;
          used_slots: number;
          product_ids: string[];
          notes: Record<string, unknown> | null;
          reserved_nicks: string[] | null;
          status: string;
          expires_at: string;
          purchase_cost_vnd: number | null;
          purchase_date: string | null;
          purchase_source: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          email: string;
          provider: string;
          max_slots: number;
          used_slots?: number;
          product_ids?: string[];
          notes?: Record<string, unknown> | null;
          reserved_nicks?: string[] | null;
          status?: string;
          expires_at: string;
          purchase_cost_vnd?: number | null;
          purchase_date?: string | null;
          purchase_source?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          email?: string;
          provider?: string;
          max_slots?: number;
          used_slots?: number;
          product_ids?: string[];
          notes?: Record<string, unknown> | null;
          reserved_nicks?: string[] | null;
          status?: string;
          expires_at?: string;
          purchase_cost_vnd?: number | null;
          purchase_date?: string | null;
          purchase_source?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_payment_source_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["payment_source_id"];
          }
        ];
      };
      customer_groups: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          color: string;
          description: string | null;
          rules: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          color?: string;
          description?: string | null;
          rules?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          color?: string;
          description?: string | null;
          rules?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      customer_tags: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_tag_assignments: {
        Row: {
          customer_id: string;
          tag_id: string;
          assigned_at: string;
        };
        Insert: {
          customer_id: string;
          tag_id: string;
          assigned_at?: string;
        };
        Update: {
          customer_id?: string;
          tag_id?: string;
          assigned_at?: string;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          account_id: string;
          action_type: string;
          customer_id: string | null;
          order_id: string | null;
          source_account_id: string | null;
          details: Record<string, unknown> | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          action_type: string;
          customer_id?: string | null;
          order_id?: string | null;
          source_account_id?: string | null;
          details?: Record<string, unknown> | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          action_type?: string;
          customer_id?: string | null;
          order_id?: string | null;
          source_account_id?: string | null;
          details?: Record<string, unknown> | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_logs_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_logs_source_account_id_fkey";
            columns: ["source_account_id"];
            isOneToOne: false;
            referencedRelation: "source_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          old_status: string | null;
          new_status: string;
          changed_by: string | null;
          change_reason: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          old_status?: string | null;
          new_status: string;
          changed_by?: string | null;
          change_reason?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          old_status?: string | null;
          new_status?: string;
          changed_by?: string | null;
          change_reason?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          amount: number;
          payment_method: string | null;
          payment_source_id: string | null;
          proof_image_url: string | null;
          note: string | null;
          paid_by: string | null;
          paid_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          amount: number;
          payment_method?: string | null;
          payment_source_id?: string | null;
          proof_image_url?: string | null;
          note?: string | null;
          paid_by?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          amount?: number;
          payment_method?: string | null;
          payment_source_id?: string | null;
          proof_image_url?: string | null;
          note?: string | null;
          paid_by?: string | null;
          paid_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
      };
      refund_requests: {
        Row: {
          id: string;
          order_id: string;
          customer_id: string | null;
          paid_amount_vnd: number;
          consumed_days: number;
          total_days: number;
          refund_mode: "full" | "pro_rata";
          refundable_amount_vnd: number;
          status: "requested" | "approved" | "processing" | "completed" | "rejected" | "cancelled";
          reason: string | null;
          admin_note: string | null;
          requested_by: string | null;
          approved_by: string | null;
          processed_by: string | null;
          requested_at: string;
          approved_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          customer_id?: string | null;
          paid_amount_vnd: number;
          consumed_days: number;
          total_days: number;
          refund_mode: "full" | "pro_rata";
          refundable_amount_vnd: number;
          status?: "requested" | "approved" | "processing" | "completed" | "rejected" | "cancelled";
          reason?: string | null;
          admin_note?: string | null;
          requested_by?: string | null;
          approved_by?: string | null;
          processed_by?: string | null;
          requested_at?: string;
          approved_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          customer_id?: string | null;
          paid_amount_vnd?: number;
          consumed_days?: number;
          total_days?: number;
          refund_mode?: "full" | "pro_rata";
          refundable_amount_vnd?: number;
          status?: "requested" | "approved" | "processing" | "completed" | "rejected" | "cancelled";
          reason?: string | null;
          admin_note?: string | null;
          requested_by?: string | null;
          approved_by?: string | null;
          processed_by?: string | null;
          requested_at?: string;
          approved_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refund_requests_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refund_requests_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      provider_product_prices: {
        Row: {
          id: string;
          account_id: string;
          provider_id: string;
          product_id: string;
          cost_vnd: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          provider_id: string;
          product_id: string;
          cost_vnd: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          provider_id?: string;
          product_id?: string;
          cost_vnd?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provider_product_prices_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_product_prices_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "provider_product_prices_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          id: string;
          account_id: string;
          provider_id: string;
          items: Record<string, unknown>[];
          status: "pending" | "partial" | "received" | "cancelled";
          total_amount_vnd: number;
          total_paid_vnd: number;
          payment_method: string | null;
          notes: string | null;
          received_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          provider_id: string;
          items?: Record<string, unknown>[];
          status?: "pending" | "partial" | "received" | "cancelled";
          total_amount_vnd: number;
          total_paid_vnd?: number;
          payment_method?: string | null;
          notes?: string | null;
          received_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          provider_id?: string;
          items?: Record<string, unknown>[];
          status?: "pending" | "partial" | "received" | "cancelled";
          total_amount_vnd?: number;
          total_paid_vnd?: number;
          payment_method?: string | null;
          notes?: string | null;
          received_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          },
        ];
      };
      system_settings: {
        Row: {
          id: string;
          account_id: string;
          company_name: string;
          tax_id: string;
          company_address: string;
          personal_name: string;
          bank_name: string;
          bank_account: string;
          default_notes: string;
          qr_transfer_content: string | null;
          default_currency: string;
          locale: string;
          timezone: string;
          invoice_prefix: string;
          tax_label: string;
          tax_rate_default: number;
          payment_instruction_template: string;
          sales_landing_config: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          company_name?: string;
          tax_id?: string;
          company_address?: string;
          personal_name?: string;
          bank_name?: string;
          bank_account?: string;
          default_notes?: string;
          qr_transfer_content?: string | null;
          default_currency?: string;
          locale?: string;
          timezone?: string;
          invoice_prefix?: string;
          tax_label?: string;
          tax_rate_default?: number;
          payment_instruction_template?: string;
          sales_landing_config?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          company_name?: string;
          tax_id?: string;
          company_address?: string;
          personal_name?: string;
          bank_name?: string;
          bank_account?: string;
          default_notes?: string;
          qr_transfer_content?: string | null;
          default_currency?: string;
          locale?: string;
          timezone?: string;
          invoice_prefix?: string;
          tax_label?: string;
          tax_rate_default?: number;
          payment_instruction_template?: string;
          sales_landing_config?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          account_id: string;
          provider: string;
          access_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
          status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          provider: string;
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          provider?: string;
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          name: string;
          owner_email: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_email: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_email?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          account_id: string | null;
        };
        Insert: {
          id?: string;
          account_id?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string | null;
        };
        Relationships: [];
      };
      webhook_endpoints: {
        Row: {
          id: string;
          account_id: string;
          url: string;
          secret: string;
          events: string[];
          is_active: boolean;
          description: string | null;
          consecutive_failures: number;
          last_success_at: string | null;
          last_failure_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          url: string;
          secret: string;
          events?: string[];
          is_active?: boolean;
          description?: string | null;
          consecutive_failures?: number;
          last_success_at?: string | null;
          last_failure_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          url?: string;
          secret?: string;
          events?: string[];
          is_active?: boolean;
          description?: string | null;
          consecutive_failures?: number;
          last_success_at?: string | null;
          last_failure_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          account_id: string;
          endpoint_id: string;
          event_type: string;
          payload: Record<string, unknown>;
          status: "pending" | "delivered" | "failed" | "skipped";
          attempts: number;
          max_attempts: number;
          last_attempt_at: string | null;
          next_retry_at: string | null;
          response_status: number | null;
          response_body: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          endpoint_id: string;
          event_type: string;
          payload: Record<string, unknown>;
          status?: "pending" | "delivered" | "failed" | "skipped";
          attempts?: number;
          max_attempts?: number;
          last_attempt_at?: string | null;
          next_retry_at?: string | null;
          response_status?: number | null;
          response_body?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          endpoint_id?: string;
          event_type?: string;
          payload?: Record<string, unknown>;
          status?: "pending" | "delivered" | "failed" | "skipped";
          attempts?: number;
          max_attempts?: number;
          last_attempt_at?: string | null;
          next_retry_at?: string | null;
          response_status?: number | null;
          response_body?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reminder_logs: {
        Row: {
          id: string;
          account_id: string;
          order_id: string | null;
          customer_id: string | null;
          reminder_type: string;
          channel: string;
          status: string;
          message_content: string | null;
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          order_id?: string | null;
          customer_id?: string | null;
          reminder_type: string;
          channel: string;
          status: string;
          message_content?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          order_id?: string | null;
          customer_id?: string | null;
          reminder_type?: string;
          channel?: string;
          status?: string;
          message_content?: string | null;
          error_message?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_logs_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_logs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reminder_logs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      escalation_rules: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          trigger_type: "overdue_days" | "debt_amount" | "no_payment";
          threshold_value: number;
          action_type: "reminder" | "warning" | "lock_service" | "notify_admin";
          action_config: Record<string, unknown>;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          trigger_type: "overdue_days" | "debt_amount" | "no_payment";
          threshold_value: number;
          action_type: "reminder" | "warning" | "lock_service" | "notify_admin";
          action_config?: Record<string, unknown>;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          trigger_type?: "overdue_days" | "debt_amount" | "no_payment";
          threshold_value?: number;
          action_type?: "reminder" | "warning" | "lock_service" | "notify_admin";
          action_config?: Record<string, unknown>;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      short_link_clicks: {
        Row: {
          id: string;
          short_link_id: string;
          ip_address: string;
          user_agent: string | null;
          referer: string | null;
          device_type: string | null;
          is_suspicious: boolean;
          suspicious_reason: string | null;
          country: string | null;
          city: string | null;
          ip_version: string | null;
          event_type: "bot_preview" | "landing_view" | "redirect_click" | "blocked";
          clicked_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          short_link_id: string;
          ip_address: string;
          user_agent?: string | null;
          referer?: string | null;
          device_type?: string | null;
          is_suspicious?: boolean;
          suspicious_reason?: string | null;
          country?: string | null;
          city?: string | null;
          ip_version?: string | null;
          event_type?: "bot_preview" | "landing_view" | "redirect_click" | "blocked";
          clicked_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          short_link_id?: string;
          ip_address?: string;
          user_agent?: string | null;
          referer?: string | null;
          device_type?: string | null;
          is_suspicious?: boolean;
          suspicious_reason?: string | null;
          country?: string | null;
          city?: string | null;
          ip_version?: string | null;
          event_type?: "bot_preview" | "landing_view" | "redirect_click" | "blocked";
          clicked_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      reminder_events: {
        Row: {
          id: string;
          account_id: string;
          title: string;
          type: "reminder" | "renewal" | "follow_up" | "meeting" | "payment" | "debt";
          due_at: string;
          is_done: boolean;
          customer_id: string | null;
          customer_ids: string[] | null;
          notes: string | null;
          has_reminder: boolean;
          gcal_event_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          title: string;
          type?: "reminder" | "renewal" | "follow_up" | "meeting" | "payment" | "debt";
          due_at: string;
          is_done?: boolean;
          customer_id?: string | null;
          customer_ids?: string[] | null;
          notes?: string | null;
          has_reminder?: boolean;
          gcal_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          title?: string;
          type?: "reminder" | "renewal" | "follow_up" | "meeting" | "payment" | "debt";
          due_at?: string;
          is_done?: boolean;
          customer_id?: string | null;
          customer_ids?: string[] | null;
          notes?: string | null;
          has_reminder?: boolean;
          gcal_event_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          /** Product name frozen at time of purchase — never changes even if product is renamed. */
          product_name_snapshot: string;
          quantity: number;
          /** Unit price frozen at time of purchase. */
          price_vnd: number;
          /** Cost price frozen at time of purchase. */
          cost_price_vnd: number | null;
          /** price_vnd × quantity — computed and stored for fast invoice rendering. */
          subtotal_vnd: number;
          notes: string | null;
          assigned_source_account_id: string | null;
          customer_nick_used: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_name_snapshot: string;
          quantity: number;
          price_vnd: number;
          cost_price_vnd?: number | null;
          subtotal_vnd: number;
          notes?: string | null;
          assigned_source_account_id?: string | null;
          customer_nick_used?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string;
          product_name_snapshot?: string;
          quantity?: number;
          price_vnd?: number;
          cost_price_vnd?: number | null;
          subtotal_vnd?: number;
          notes?: string | null;
          assigned_source_account_id?: string | null;
          customer_nick_used?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      license_keys: {
        Row: {
          id: string;
          account_id: string;
          key_code: string;
          product_id: string;
          status: "available" | "reserved" | "used" | "expired" | "invalid";
          order_id: string | null;
          assigned_at: string | null;
          notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          key_code: string;
          product_id: string;
          status?: "available" | "reserved" | "used" | "expired" | "invalid";
          order_id?: string | null;
          assigned_at?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          key_code?: string;
          product_id?: string;
          status?: "available" | "reserved" | "used" | "expired" | "invalid";
          order_id?: string | null;
          assigned_at?: string | null;
          notes?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "license_keys_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "license_keys_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_sources: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          icon: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          icon?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sales_channels: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          default_delivery_mode: "direct_redirect" | "landing_page";
          default_landing_template_key: "owner_intro" | "ctv_neutral";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          default_delivery_mode?: "direct_redirect" | "landing_page";
          default_landing_template_key?: "owner_intro" | "ctv_neutral";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          default_delivery_mode?: "direct_redirect" | "landing_page";
          default_landing_template_key?: "owner_intro" | "ctv_neutral";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_users: {
        Row: {
          id: string;
          account_id: string;
          email: string;
          password_hash: string;
          first_name: string;
          last_name: string;
          role: "admin" | "staff" | "viewer";
          status: "active" | "suspended" | "invited";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          email: string;
          password_hash: string;
          first_name: string;
          last_name: string;
          role?: "admin" | "staff" | "viewer";
          status?: "active" | "suspended" | "invited";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          email?: string;
          password_hash?: string;
          first_name?: string;
          last_name?: string;
          role?: "admin" | "staff" | "viewer";
          status?: "active" | "suspended" | "invited";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      //  PREMIUM MODULE 
      premium_service_types: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          slug: string;
          description: string | null;
          logo_url: string | null;
          website: string | null;
          category: string | null;
          supports_connection_check: boolean;
          connection_check_type: "api" | "manual" | "scheduled" | null;
          connection_check_api_url: string | null;
          max_packages_allowed: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          name: string;
          slug: string;
          description?: string | null;
          logo_url?: string | null;
          website?: string | null;
          category?: string | null;
          supports_connection_check?: boolean;
          connection_check_type?: "api" | "manual" | "scheduled" | null;
          connection_check_api_url?: string | null;
          max_packages_allowed?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          logo_url?: string | null;
          website?: string | null;
          category?: string | null;
          supports_connection_check?: boolean;
          connection_check_type?: "api" | "manual" | "scheduled" | null;
          connection_check_api_url?: string | null;
          max_packages_allowed?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "premium_service_types_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      premium_packages: {
        Row: {
          id: string;
          account_id: string;
          service_type_id: string;
          name: string;
          slug: string;
          description: string | null;
          total_slots: number;
          default_price: number;
          billing_cycles: string[] | null;
          allow_flexible_renewal_pricing: boolean;
          renewal_price_factor: number | null;
          features: Record<string, unknown> | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          service_type_id: string;
          name: string;
          slug: string;
          description?: string | null;
          total_slots?: number;
          default_price: number;
          billing_cycles?: string[] | null;
          allow_flexible_renewal_pricing?: boolean;
          renewal_price_factor?: number | null;
          features?: Record<string, unknown> | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          service_type_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          total_slots?: number;
          default_price?: number;
          billing_cycles?: string[] | null;
          allow_flexible_renewal_pricing?: boolean;
          renewal_price_factor?: number | null;
          features?: Record<string, unknown> | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "premium_packages_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_packages_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "premium_service_types";
            referencedColumns: ["id"];
          }
        ];
      };
      premium_accounts: {
        Row: {
          id: string;
          account_id: string;
          service_type_id: string;
          package_id: string;
          primary_email: string;
          primary_password_encrypted: string;
          secondary_emails: string[] | null;
          phone_number: string | null;
          total_slots: number;
          used_slots: number;
          subscription_start_date: string | null;
          subscription_expiry_date: string | null;
          subscription_renewal_count: number;
          status: "active" | "expired" | "suspended" | "cancelled";
          connection_status: "working" | "error" | "manual_check_needed" | null;
          last_connection_check_at: string | null;
          purchase_invoice_url: string | null;
          notes: string | null;
          password_change_count: number;
          last_password_changed_at: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          service_type_id: string;
          package_id: string;
          primary_email: string;
          primary_password_encrypted: string;
          secondary_emails?: string[] | null;
          phone_number?: string | null;
          total_slots?: number;
          used_slots?: number;
          subscription_start_date?: string | null;
          subscription_expiry_date?: string | null;
          subscription_renewal_count?: number;
          status?: "active" | "expired" | "suspended" | "cancelled";
          connection_status?: "working" | "error" | "manual_check_needed" | null;
          last_connection_check_at?: string | null;
          purchase_invoice_url?: string | null;
          notes?: string | null;
          password_change_count?: number;
          last_password_changed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          service_type_id?: string;
          package_id?: string;
          primary_email?: string;
          primary_password_encrypted?: string;
          secondary_emails?: string[] | null;
          phone_number?: string | null;
          total_slots?: number;
          used_slots?: number;
          subscription_start_date?: string | null;
          subscription_expiry_date?: string | null;
          subscription_renewal_count?: number;
          status?: "active" | "expired" | "suspended" | "cancelled";
          connection_status?: "working" | "error" | "manual_check_needed" | null;
          last_connection_check_at?: string | null;
          purchase_invoice_url?: string | null;
          notes?: string | null;
          password_change_count?: number;
          last_password_changed_at?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "premium_accounts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_accounts_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "premium_service_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_accounts_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "premium_packages";
            referencedColumns: ["id"];
          }
        ];
      };
      premium_account_users: {
        Row: {
          id: string;
          account_id: string;
          premium_account_id: string;
          user_email: string;
          status: "active" | "removed" | "suspended";
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          premium_account_id: string;
          user_email: string;
          status?: "active" | "removed" | "suspended";
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          premium_account_id?: string;
          user_email?: string;
          status?: "active" | "removed" | "suspended";
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "premium_account_users_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_account_users_premium_account_id_fkey";
            columns: ["premium_account_id"];
            isOneToOne: false;
            referencedRelation: "premium_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      customer_premium_subscriptions: {
        Row: {
          id: string;
          account_id: string;
          customer_id: string;
          order_id: string | null;
          premium_account_id: string;
          premium_account_user_id: string | null;
          service_type_id: string;
          package_id: string;
          billing_cycle: string;
          cycle_months: number;
          start_date: string;
          expiry_date: string;
          original_price: number;
          discount: number;
          final_price: number;
          renewal_status: string;
          status: string;
          notes: string | null;
          refund_amount: number | null;
          renewal_asked_at: string | null;
          renewal_confirmed_at: string | null;
          renewal_denied_at: string | null;
          renewal_denied_reason: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          customer_id: string;
          order_id?: string | null;
          premium_account_id: string;
          premium_account_user_id?: string | null;
          service_type_id: string;
          package_id: string;
          billing_cycle: string;
          cycle_months: number;
          start_date: string;
          expiry_date: string;
          original_price: number;
          discount?: number;
          final_price: number;
          renewal_status?: string;
          status?: string;
          notes?: string | null;
          refund_amount?: number | null;
          renewal_asked_at?: string | null;
          renewal_confirmed_at?: string | null;
          renewal_denied_at?: string | null;
          renewal_denied_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          customer_id?: string;
          order_id?: string | null;
          premium_account_id?: string;
          premium_account_user_id?: string | null;
          service_type_id?: string;
          package_id?: string;
          billing_cycle?: string;
          cycle_months?: number;
          start_date?: string;
          expiry_date?: string;
          original_price?: number;
          discount?: number;
          final_price?: number;
          renewal_status?: string;
          status?: string;
          notes?: string | null;
          refund_amount?: number | null;
          renewal_asked_at?: string | null;
          renewal_confirmed_at?: string | null;
          renewal_denied_at?: string | null;
          renewal_denied_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
          Relationships: [
            {
              foreignKeyName: "customer_premium_subscriptions_account_id_fkey";
              columns: ["account_id"];
              isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_premium_subscriptions_premium_account_id_fkey";
            columns: ["premium_account_id"];
            isOneToOne: false;
            referencedRelation: "premium_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_premium_subscriptions_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "premium_packages";
            referencedColumns: ["id"];
          },
            {
              foreignKeyName: "customer_premium_subscriptions_service_type_id_fkey";
              columns: ["service_type_id"];
              isOneToOne: false;
              referencedRelation: "premium_service_types";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "customer_premium_subscriptions_premium_account_user_id_fkey";
              columns: ["premium_account_user_id"];
              isOneToOne: false;
            referencedRelation: "premium_account_users";
            referencedColumns: ["id"];
          }
        ];
      };
      premium_account_health_logs: {
        Row: {
          id: string;
          premium_account_id: string;
          account_id: string;
          service_type_id: string;
          check_timestamp: string;
          check_type: "api" | "manual" | "scheduled";
          current_status: "working" | "error" | "unknown";
          previous_status: string | null;
          response_time_ms: number | null;
          error_message: string | null;
          error_code: string | null;
          api_response: Record<string, unknown> | null;
          checked_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          premium_account_id: string;
          account_id: string;
          service_type_id: string;
          check_timestamp?: string;
          check_type: "api" | "manual" | "scheduled";
          current_status: "working" | "error" | "unknown";
          previous_status?: string | null;
          response_time_ms?: number | null;
          error_message?: string | null;
          error_code?: string | null;
          api_response?: Record<string, unknown> | null;
          checked_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          premium_account_id?: string;
          account_id?: string;
          service_type_id?: string;
          check_timestamp?: string;
          check_type?: "api" | "manual" | "scheduled";
          current_status?: "working" | "error" | "unknown";
          previous_status?: string | null;
          response_time_ms?: number | null;
          error_message?: string | null;
          error_code?: string | null;
          api_response?: Record<string, unknown> | null;
          checked_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "premium_account_health_logs_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_account_health_logs_premium_account_id_fkey";
            columns: ["premium_account_id"];
            isOneToOne: false;
            referencedRelation: "premium_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_account_health_logs_service_type_id_fkey";
            columns: ["service_type_id"];
            isOneToOne: false;
            referencedRelation: "premium_service_types";
            referencedColumns: ["id"];
          }
        ];
      };
      premium_account_user_history: {
        Row: {
          id: string;
          account_user_id: string;
          premium_account_id: string;
          account_id: string;
          change_type: "email_change" | "password_change" | "status_change" | "added" | "removed";
          old_value: string | null;
          new_value: string | null;
          old_email: string | null;
          new_email: string | null;
          reason: string | null;
          changed_by: string | null;
          ip_address: string | null;
          user_agent: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          account_user_id: string;
          premium_account_id: string;
          account_id: string;
          change_type: "email_change" | "password_change" | "status_change" | "added" | "removed";
          old_value?: string | null;
          new_value?: string | null;
          old_email?: string | null;
          new_email?: string | null;
          reason?: string | null;
          changed_by?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          account_user_id?: string;
          premium_account_id?: string;
          account_id?: string;
          change_type?: "email_change" | "password_change" | "status_change" | "added" | "removed";
          old_value?: string | null;
          new_value?: string | null;
          old_email?: string | null;
          new_email?: string | null;
          reason?: string | null;
          changed_by?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "premium_account_user_history_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_account_user_history_account_user_id_fkey";
            columns: ["account_user_id"];
            isOneToOne: false;
            referencedRelation: "premium_account_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "premium_account_user_history_premium_account_id_fkey";
            columns: ["premium_account_id"];
            isOneToOne: false;
            referencedRelation: "premium_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      account_migrations: {
        Row: {
          id: string;
          account_id: string;
          subscription_id: string;
          customer_id: string;
          source_account_id: string;
          target_account_id: string;
          source_account_email: string | null;
          target_account_email: string | null;
          source_user_id: string | null;
          target_user_id: string | null;
          reason: string | null;
          initiated_by: string | null;
          status: "pending" | "in_progress" | "completed" | "failed" | "rollback";
          started_at: string;
          completed_at: string | null;
          details: Record<string, unknown> | null;
          error_log: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          subscription_id: string;
          customer_id: string;
          source_account_id: string;
          target_account_id: string;
          source_account_email?: string | null;
          target_account_email?: string | null;
          source_user_id?: string | null;
          target_user_id?: string | null;
          reason?: string | null;
          initiated_by?: string | null;
          status?: "pending" | "in_progress" | "completed" | "failed" | "rollback";
          started_at?: string;
          completed_at?: string | null;
          details?: Record<string, unknown> | null;
          error_log?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          subscription_id?: string;
          customer_id?: string;
          source_account_id?: string;
          target_account_id?: string;
          source_account_email?: string | null;
          target_account_email?: string | null;
          source_user_id?: string | null;
          target_user_id?: string | null;
          reason?: string | null;
          initiated_by?: string | null;
          status?: "pending" | "in_progress" | "completed" | "failed" | "rollback";
          started_at?: string;
          completed_at?: string | null;
          details?: Record<string, unknown> | null;
          error_log?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
          Relationships: [
            {
              foreignKeyName: "account_migrations_account_id_fkey";
              columns: ["account_id"];
              isOneToOne: false;
              referencedRelation: "accounts";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "account_migrations_subscription_id_fkey";
              columns: ["subscription_id"];
              isOneToOne: false;
              referencedRelation: "customer_premium_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_migrations_source_account_id_fkey";
            columns: ["source_account_id"];
            isOneToOne: false;
            referencedRelation: "premium_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_migrations_target_account_id_fkey";
            columns: ["target_account_id"];
            isOneToOne: false;
            referencedRelation: "premium_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_migrations_source_user_id_fkey";
            columns: ["source_user_id"];
            isOneToOne: false;
            referencedRelation: "premium_account_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "account_migrations_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "premium_account_users";
            referencedColumns: ["id"];
          }
        ];
      };
      account_migration_history: {
        Row: {
          id: string;
          migration_id: string;
          account_id: string;
          step_number: number;
          step_name: string;
          step_status: "pending" | "in_progress" | "completed" | "failed";
          details: Record<string, unknown> | null;
          error_message: string | null;
          started_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          migration_id: string;
          account_id: string;
          step_number: number;
          step_name: string;
          step_status: "pending" | "in_progress" | "completed" | "failed";
          details?: Record<string, unknown> | null;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          migration_id?: string;
          account_id?: string;
          step_number?: number;
          step_name?: string;
          step_status?: "pending" | "in_progress" | "completed" | "failed";
          details?: Record<string, unknown> | null;
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
          Relationships: [
            {
              foreignKeyName: "account_migration_history_account_id_fkey";
              columns: ["account_id"];
              isOneToOne: false;
              referencedRelation: "accounts";
              referencedColumns: ["id"];
            },
            {
              foreignKeyName: "account_migration_history_migration_id_fkey";
              columns: ["migration_id"];
              isOneToOne: false;
              referencedRelation: "account_migrations";
            referencedColumns: ["id"];
          }
        ];
      };
      short_links: {
        Row: {
          id: string;
          account_id: string;
          slug: string;
          target_url: string;
          title: string | null;
          max_clicks: number;
          current_clicks: number;
          expires_at: string | null;
          status: "active" | "expired" | "disabled";
          order_id: string | null;
          customer_id: string | null;
          created_by: string | null;
          access_token: string | null;
          locked_ip: string | null;
          locked_ipv6: string | null;
          require_token: boolean;
          notify_clicks: boolean;
          sales_channel_id: string | null;
          delivery_mode: "inherit_channel" | "direct_redirect" | "landing_page";
          landing_template_key: "owner_intro" | "ctv_neutral" | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          account_id: string;
          slug: string;
          target_url: string;
          title?: string | null;
          max_clicks?: number;
          current_clicks?: number;
          expires_at?: string | null;
          status?: "active" | "expired" | "disabled";
          order_id?: string | null;
          customer_id?: string | null;
          created_by?: string | null;
          access_token?: string | null;
          locked_ip?: string | null;
          locked_ipv6?: string | null;
          require_token?: boolean;
          notify_clicks?: boolean;
          sales_channel_id?: string | null;
          delivery_mode?: "inherit_channel" | "direct_redirect" | "landing_page";
          landing_template_key?: "owner_intro" | "ctv_neutral" | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          slug?: string;
          target_url?: string;
          title?: string | null;
          max_clicks?: number;
          current_clicks?: number;
          expires_at?: string | null;
          status?: "active" | "expired" | "disabled";
          order_id?: string | null;
          customer_id?: string | null;
          created_by?: string | null;
          access_token?: string | null;
          locked_ip?: string | null;
          locked_ipv6?: string | null;
          require_token?: boolean;
          notify_clicks?: boolean;
          sales_channel_id?: string | null;
          delivery_mode?: "inherit_channel" | "direct_redirect" | "landing_page";
          landing_template_key?: "owner_intro" | "ctv_neutral" | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_renewals: {
        Row: {
          id: string;
          account_id: string;
          original_subscription_id: string;
          customer_id: string;
          status: string;
          renewal_requested_date: string | null;
          renewal_confirmed_date: string | null;
          renewal_price: number | null;
          total_price: number | null;
          new_billing_cycle: string | null;
          customer_response: string | null;
          customer_response_date: string | null;
          decline_reason: string | null;
          original_price: number | null;
          refund_calculated: boolean;
          refund_amount: number | null;
          refund_calculation_method: string | null;
          refund_approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          original_subscription_id: string;
          customer_id: string;
          status?: string;
          renewal_requested_date?: string | null;
          renewal_confirmed_date?: string | null;
          renewal_price?: number | null;
          total_price?: number | null;
          new_billing_cycle?: string | null;
          customer_response?: string | null;
          customer_response_date?: string | null;
          decline_reason?: string | null;
          original_price?: number | null;
          refund_calculated?: boolean;
          refund_amount?: number | null;
          refund_calculation_method?: string | null;
          refund_approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          account_id?: string;
          original_subscription_id?: string;
          customer_id?: string;
          status?: string;
          renewal_requested_date?: string | null;
          renewal_confirmed_date?: string | null;
          renewal_price?: number | null;
          total_price?: number | null;
          new_billing_cycle?: string | null;
          customer_response?: string | null;
          customer_response_date?: string | null;
          decline_reason?: string | null;
          original_price?: number | null;
          refund_calculated?: boolean;
          refund_amount?: number | null;
          refund_calculation_method?: string | null;
          refund_approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_renewals_original_subscription_id_fkey";
            columns: ["original_subscription_id"];
            isOneToOne: false;
            referencedRelation: "customer_premium_subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_renewals_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      provider_stats_view: {
        Row: {
          id: string;
          account_id: string;
          name: string;
          contacts: Record<string, unknown>[] | null;
          tier: string;
          reliability_score: number;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          total_import_amount_vnd: number;
          purchase_order_count: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
