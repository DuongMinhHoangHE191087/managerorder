export interface RenewalItem {
  id: string;
  customer_name?: string;
  customer_email?: string;
  service_name?: string;
  package_name?: string;
  expiry_date: string;
  days_remaining: number;
  billing_cycle?: string;
  final_price?: number;
  renewal_status?: string;
}
