-- Create a view that aggregates purchase order stats for each provider
CREATE OR REPLACE VIEW provider_stats_view AS
SELECT 
  p.id,
  p.account_id,
  p.name,
  p.contacts,
  p.tier,
  p.reliability_score,
  p.created_at,
  p.updated_at,
  p.deleted_at,
  COALESCE(SUM(po.total_amount_vnd), 0) AS total_import_amount_vnd,
  COUNT(po.id) AS purchase_order_count
FROM providers p
LEFT JOIN purchase_orders po 
  ON po.provider_id = p.id 
  AND po.deleted_at IS NULL
GROUP BY 
  p.id, 
  p.account_id, 
  p.name, 
  p.contacts, 
  p.tier, 
  p.reliability_score, 
  p.created_at, 
  p.updated_at, 
  p.deleted_at;
