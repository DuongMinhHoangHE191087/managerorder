import { formatMoney } from "@/lib/utils";
import type { CustomerOrder } from "@/shared/types/customers";
import type { Customer360Stats } from "@/widgets/pages/customers/hooks/use-customers";

export type CustomerProfileActionTone = "critical" | "warning" | "positive" | "neutral";

export interface CustomerStatusBreakdownItem {
  status: string;
  label: string;
  count: number;
  share: number;
}

export interface CustomerProfileAction {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  tone: CustomerProfileActionTone;
}

export interface CustomerProfileInsights {
  collectionRate: number;
  recentOrders30d: number;
  activeDebtOrders: number;
  averageDaysBetweenOrders: number | null;
  statusBreakdown: CustomerStatusBreakdownItem[];
  nextActions: CustomerProfileAction[];
}

const STATUS_LABELS: Record<string, string> = {
  paid: "Da thanh toan",
  active: "Dang chay",
  completed: "Hoan tat",
  pending: "Cho xu ly",
  pending_payment: "Cho thanh toan",
  provisioning: "Dang cap",
  cancelled: "Da huy",
  refunded: "Da hoan tien",
};

const NON_DEBT_STATUSES = new Set(["cancelled", "refunded"]);
const OPEN_PIPELINE_STATUSES = new Set(["pending", "pending_payment", "provisioning"]);

function roundToInt(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function getDaysSince(dateString: string | null | undefined) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, roundToInt((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
}

function getAverageDaysBetweenOrders(orders: CustomerOrder[]) {
  if (orders.length < 2) return null;

  const timestamps = orders
    .map((order) => new Date(order.created_at).getTime())
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((left, right) => left - right);

  if (timestamps.length < 2) return null;

  const totalGap = timestamps.slice(1).reduce((sum, timestamp, index) => {
    const previous = timestamps[index];
    return sum + (timestamp - previous);
  }, 0);

  return roundToInt(totalGap / (timestamps.length - 1) / (1000 * 60 * 60 * 24));
}

function getStatusBreakdown(
  stats: Customer360Stats | null | undefined,
  orders: CustomerOrder[],
): CustomerStatusBreakdownItem[] {
  const source = stats?.ordersByStatus ?? orders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  const totalOrders = Object.values(source).reduce((sum, count) => sum + count, 0);
  if (totalOrders === 0) return [];

  return Object.entries(source)
    .sort((left, right) => right[1] - left[1])
    .map(([status, count]) => ({
      status,
      label: STATUS_LABELS[status] ?? status,
      count,
      share: roundToInt((count / totalOrders) * 100),
    }));
}

export function buildCustomerProfileInsights(input: {
  customerId: string;
  customerName: string;
  stats?: Customer360Stats | null;
  orders: CustomerOrder[];
}): CustomerProfileInsights {
  const { customerId, customerName, stats, orders } = input;
  const totalSpentVnd = stats?.totalSpentVnd ?? orders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalPaymentsVnd = stats?.totalPaymentsVnd ?? orders.reduce((sum, order) => sum + order.total_paid, 0);
  const collectionRate = totalSpentVnd > 0
    ? Math.min(100, roundToInt((totalPaymentsVnd / totalSpentVnd) * 100))
    : 100;
  const recentOrders30d = orders.filter((order) => {
    const age = getDaysSince(order.created_at);
    return age !== null && age <= 30;
  }).length;
  const activeDebtOrders = orders.filter((order) => {
    const remaining = Math.max(order.total_amount - order.total_paid, 0);
    return remaining > 0 && !NON_DEBT_STATUSES.has(order.status);
  }).length;
  const averageDaysBetweenOrders = getAverageDaysBetweenOrders(orders);
  const statusBreakdown = getStatusBreakdown(stats, orders);

  const nextActions: CustomerProfileAction[] = [];
  const debtAmountVnd = stats?.debtAmountVnd ?? 0;
  const debtOverdueDays = stats?.debtOverdueDays ?? 0;
  const lastOrderAgeDays = getDaysSince(stats?.lastOrderDate);
  const openPipelineCount = statusBreakdown
    .filter((item) => OPEN_PIPELINE_STATUSES.has(item.status))
    .reduce((sum, item) => sum + item.count, 0);
  const encodedCustomerName = encodeURIComponent(customerName || "Khach hang");

  if (debtAmountVnd > 0) {
    nextActions.push({
      id: "debt-follow-up",
      title: "Thu hoi cong no",
      description: debtOverdueDays > 0
        ? `${formatMoney(debtAmountVnd)} dang qua han ${debtOverdueDays} ngay. Uu tien xu ly truoc khi mo rong don moi.`
        : `${formatMoney(debtAmountVnd)} chua thu du. Can doi chieu cac don dang no va lich nhac thanh toan.`,
      href: "#orders-panel",
      cta: "Xem don dang no",
      tone: debtOverdueDays >= 30 ? "critical" : "warning",
    });
  }

  if (openPipelineCount > 0) {
    nextActions.push({
      id: "order-ops-review",
      title: "Ra soat don dang mo",
      description: `${openPipelineCount} don dang o trang thai cho xu ly, cho thanh toan hoac dang cap. Gom lai de giam ro roi ban giao.`,
      href: "#orders-panel",
      cta: "Mo bang don hang",
      tone: "warning",
    });
  }

  if (lastOrderAgeDays !== null && lastOrderAgeDays >= 45) {
    nextActions.push({
      id: "reengage-customer",
      title: "Tai kich hoat khach hang",
      description: `${customerName || "Khach hang"} da im ${lastOrderAgeDays} ngay. Nen tao mot don moi hoac gui nhac cham soc chu dong.`,
      href: `/orders/new?customerId=${customerId}&customerName=${encodedCustomerName}`,
      cta: "Tao don moi",
      tone: "warning",
    });
  } else if (totalSpentVnd >= 2_000_000 && debtAmountVnd <= 0) {
    nextActions.push({
      id: "upsell-customer",
      title: "Giu chan khach gia tri cao",
      description: `Tong chi tieu da dat ${formatMoney(totalSpentVnd)} va khong co cong no. Day la nhom nen uu tien de upsell hoac renewal som.`,
      href: `/orders/new?customerId=${customerId}&customerName=${encodedCustomerName}`,
      cta: "Len don tiep theo",
      tone: "positive",
    });
  }

  if (nextActions.length === 0) {
    nextActions.push({
      id: "stable-profile",
      title: "Ho so dang on dinh",
      description: "Chua co tin hieu bat thuong o cong no hoac pipeline. Co the tiep tuc cham soc dinh ky va theo doi lich su tuong tac.",
      href: "#activity-panel",
      cta: "Xem lich su",
      tone: "neutral",
    });
  }

  return {
    collectionRate,
    recentOrders30d,
    activeDebtOrders,
    averageDaysBetweenOrders,
    statusBreakdown,
    nextActions: nextActions.slice(0, 3),
  };
}
