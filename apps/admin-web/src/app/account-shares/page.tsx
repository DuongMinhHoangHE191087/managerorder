import { redirect } from "next/navigation";

// Trang /account-shares đã được tích hợp vào kho hàng (/inventory).
// Redirect về trang kho hàng.
export default function AccountSharesRedirectPage() {
  redirect("/inventory");
}
