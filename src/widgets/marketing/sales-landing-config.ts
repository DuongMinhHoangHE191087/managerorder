import {
  AlertTriangle,
  Brain,
  Clock,
  Film,
  Languages,
  Lock,
  Palette,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type SalesLandingVariant =
  | "not_found"
  | "error"
  | "expired"
  | "token_required"
  | "blocked"
  | "unauthorized"
  | "auth_failed";

export const BRAND = {
  name: "Dương Minh Hoàng",
  tagline: "Dương Minh Hoàng",
  siteName: "Duong Minh Hoang",
  domain: "duongminhhoang.store",
  logoUrl:
    "https://ucqmmgopljyugxojntjv.supabase.co/storage/v1/object/public/anhAVT/avt-duolingodmh-duongminhhoang.jpeg",
} as const;

export const CONTACTS = {
  zaloPersonal: "https://zalo.me/0394497949",
  zaloGroup: "https://zalo.me/g/ioinvk167",
  messenger: "https://m.me/61581961902821",
  phone: "0394497949",
  bank: "MB Bank • 0394497949 • DUONG MINH HOANG",
} as const;

export type OfferCard = {
  icon: LucideIcon;
  label: string;
  tag: string;
  price: string;
  gradient: string;
  desc: string;
};

export const PREMIUM_OFFERS: OfferCard[] = [
  {
    icon: Brain,
    label: "ChatGPT Plus",
    tag: "HOT",
    price: "88k/tháng",
    gradient: "from-slate-700 to-slate-900",
    desc: "AI mạnh nhất để viết, code, phân tích và làm việc mỗi ngày",
  },
  {
    icon: Palette,
    label: "Canva Pro",
    tag: "Thiết kế",
    price: "Liên hệ",
    gradient: "from-fuchsia-500 to-violet-600",
    desc: "Bộ công cụ thiết kế nhanh cho nội dung, banner và social",
  },
  {
    icon: Film,
    label: "CapCut Pro",
    tag: "Video",
    price: "Liên hệ",
    gradient: "from-emerald-500 to-teal-600",
    desc: "Dựng video mượt, template mạnh, tăng tốc bán hàng",
  },
  {
    icon: Languages,
    label: "Duolingo Super",
    tag: "Học tập",
    price: "123k",
    gradient: "from-lime-500 to-green-600",
    desc: "Học ngoại ngữ không giới hạn, nhanh và tiện",
  },
];

export const TRUST_STACK = [
  { icon: ShieldCheck, label: "Uy tín 100%", desc: "Bảo hành trọn đời" },
  { icon: Sparkles, label: "Kích hoạt", desc: "Nhanh chóng 1 phút" },
  { icon: Zap, label: "Hỗ trợ 24/7", desc: "Zalo luôn túc trực" },
  { icon: Star, label: "Review", desc: "2,500+ Khách hàng" },
] as const;

export type VariantCopy = {
  icon: LucideIcon;
  iconColor: string;
  gradient: string;
  accent: string;
  title: string;
  desc: string;
  primaryAction: { label: string; href?: string };
  secondaryAction?: { label: string; href?: string };
};

export const SALES_VARIANT_COPY: Record<SalesLandingVariant, VariantCopy> = {
  not_found: {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    gradient: "from-amber-50 to-orange-50",
    accent: "border-amber-200/60",
    title: "Liên kết không tồn tại (404)",
    desc: "Đường dẫn bạn đang truy cập không khả dụng. Nếu cần một gói dịch vụ chất lượng, hãy xem các offer bên dưới hoặc nhắn Zalo để được tư vấn nhanh.",
    primaryAction: { label: "Xem ưu đãi", href: "#offers" },
    secondaryAction: { label: "Trang chủ", href: "/" },
  },
  blocked: {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    gradient: "from-amber-50 to-orange-50",
    accent: "border-amber-200/60",
    title: "Truy cập bị chặn",
    desc: "Phiên truy cập này không hợp lệ hoặc đã bị hệ thống bảo vệ chặn lại. Bạn có thể quay về trang chủ hoặc xem bảng giá ngay bên dưới.",
    primaryAction: { label: "Xem ưu đãi", href: "#offers" },
    secondaryAction: { label: "Trang chủ", href: "/" },
  },
  unauthorized: {
    icon: Lock,
    iconColor: "text-violet-500",
    gradient: "from-violet-50 to-purple-50",
    accent: "border-violet-200/60",
    title: "Cần đăng nhập để tiếp tục",
    desc: "Tài khoản hiện tại chưa được cấp quyền. Hãy đăng nhập lại hoặc đăng xuất rồi quay lại trang đăng nhập để xác thực đúng tài khoản.",
    primaryAction: { label: "Đăng nhập lại", href: "/login" },
    secondaryAction: { label: "Xem ưu đãi", href: "#offers" },
  },
  auth_failed: {
    icon: Lock,
    iconColor: "text-violet-500",
    gradient: "from-violet-50 to-purple-50",
    accent: "border-violet-200/60",
    title: "Đăng nhập chưa thành công",
    desc: "Phiên xác thực chưa hoàn tất. Bạn có thể thử lại ngay, hoặc nhắn Zalo để được hỗ trợ kích hoạt và kiểm tra quyền truy cập.",
    primaryAction: { label: "Thử lại đăng nhập", href: "/login" },
    secondaryAction: { label: "Nhắn Zalo", href: CONTACTS.zaloPersonal },
  },
  expired: {
    icon: Clock,
    iconColor: "text-rose-500",
    gradient: "from-rose-50 to-pink-50",
    accent: "border-rose-200/60",
    title: "Liên kết đã hết hạn",
    desc: "Liên kết đã hết số lần sử dụng hoặc quá thời hạn quy định. Bạn có thể liên hệ để được cấp link mới hoặc mua gói mới ngay.",
    primaryAction: { label: "Mua link mới", href: CONTACTS.zaloPersonal },
    secondaryAction: { label: "Xem ưu đãi", href: "#offers" },
  },
  token_required: {
    icon: Lock,
    iconColor: "text-violet-500",
    gradient: "from-violet-50 to-purple-50",
    accent: "border-violet-200/60",
    title: "Yêu cầu xác thực",
    desc: "Liên kết đang được bảo vệ. Hãy liên hệ để nhận mã mở khóa hoặc mua dịch vụ cấp tốc phù hợp với nhu cầu.",
    primaryAction: { label: "Mở khóa ngay", href: CONTACTS.zaloPersonal },
    secondaryAction: { label: "Trang chủ", href: "/" },
  },
  error: {
    icon: AlertTriangle,
    iconColor: "text-rose-500",
    gradient: "from-rose-50 to-pink-50",
    accent: "border-rose-200/60",
    title: "Hệ thống gặp sự cố",
    desc: "Xin lỗi, hệ thống đang gặp lỗi tạm thời. Trong lúc chờ khắc phục, bạn vẫn có thể xem bảng giá ưu đãi hoặc quay lại sau ít phút.",
    primaryAction: { label: "Thử lại", href: "/" },
    secondaryAction: { label: "Xem ưu đãi", href: "#offers" },
  },
};

export const AUTH_ERROR_COPY: Record<string, string> = {
  auth_failed: "Đăng nhập Google chưa thành công. Vui lòng thử lại.",
  callback_failed: "Không hoàn tất được bước xác thực Google. Vui lòng thử lại.",
  oauth_denied: "Bạn đã hủy đăng nhập Google.",
  oauth_error: "Google OAuth gặp lỗi. Vui lòng thử lại.",
  access_denied: "Bạn đã từ chối cấp quyền đăng nhập.",
};

export function getSalesVariantCopy(variant: SalesLandingVariant): VariantCopy {
  return SALES_VARIANT_COPY[variant];
}

export function getAuthErrorMessage(errorCode?: string | null, reason?: string | null) {
  if (!errorCode) {
    return null;
  }

  if (errorCode === "auth_failed" || errorCode === "callback_failed") {
    return reason?.trim() || AUTH_ERROR_COPY[errorCode];
  }

  return AUTH_ERROR_COPY[errorCode] || reason?.trim() || "Đã xảy ra lỗi xác thực. Vui lòng thử lại.";
}
