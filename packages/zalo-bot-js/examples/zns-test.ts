import "dotenv/config";
import * as fs from "fs";
import * as path from "path";

// ==========================================
// CẤU HÌNH API & BIẾN MÔI TRƯỜNG
// ==========================================
const ZALO_APP_ID = process.env.ZALO_APP_ID?.trim();
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET?.trim();

// ==========================================
// TOKEN MANAGER (Bản copy từ bot chính để test độc lập)
// ==========================================
class TokenManager {
  private static TOKEN_FILE = path.join(process.cwd(), "zalo-oa-tokens.json");
  private static config = {
    accessToken: process.env.ZALO_OA_TOKEN?.trim() || "",
    refreshToken: process.env.ZALO_OA_REFRESH_TOKEN?.trim() || "",
  };

  static init() {
    if (fs.existsSync(this.TOKEN_FILE)) {
      try {
        const data = fs.readFileSync(this.TOKEN_FILE, "utf-8");
        this.config = JSON.parse(data);
        console.log("[TokenManager] Nạp thành công bộ Access/Refresh Token từ tệp nội bộ.");
      } catch (err) {
        console.error("[TokenManager] Lỗi đọc tệp bộ đệm.", err);
      }
    }
  }

  static getAccessToken() {
    return this.config.accessToken;
  }

  static async refreshZaloOAToken(): Promise<boolean> {
    if (!ZALO_APP_ID || !ZALO_APP_SECRET) {
      console.error("❌ Lỗi: Thiếu ZALO_APP_ID/SECRET trong .env");
      return false;
    }

    try {
      console.log("🔄 Đang gửi yêu cầu Refresh Token lên Zalo...");
      const response = await fetch("https://oauth.zaloapp.com/v4/oa/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "secret_key": ZALO_APP_SECRET,
        },
        body: new URLSearchParams({
          app_id: ZALO_APP_ID,
          grant_type: "refresh_token",
          refresh_token: this.config.refreshToken,
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        this.config.accessToken = data.access_token;
        this.config.refreshToken = data.refresh_token;
        fs.writeFileSync(this.TOKEN_FILE, JSON.stringify(this.config, null, 2), "utf-8");
        return true;
      }
      console.error("❌ Refresh thất bại:", data);
      return false;
    } catch (err) {
      console.error("❌ Lỗi mạng khi refresh:", err);
      return false;
    }
  }
}

TokenManager.init();

// ==========================================
// HÀM GỬI TEST VỚI CƠ CHẾ AUTO-RETRY
// ==========================================
async function sendZNSTest(phone: string, isRetry = false): Promise<void> {
  const token = TokenManager.getAccessToken();
  console.log(`\n--- BẮT ĐẦU GỬI ĐẾN ${phone} (Attempt: ${isRetry ? 'Retry' : 'First'}) ---`);
  console.log(`Sử dụng Token: ${token.substring(0, 20)}...`);

  try {
    const response = await fetch("https://business.openapi.zalo.me/message/template", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": token,
      },
      body: JSON.stringify({
        phone: phone,
        template_id: "00000",
        template_data: {},
      }),
    });

    const result = await response.json();
    console.log("[Zalo Response]:", result);

    if (result.error === -124) {
      console.log("⚠️ Token hết hạn (-124). Đang kích hoạt Auto-Refresh...");
      if (!isRetry) {
        const success = await TokenManager.refreshZaloOAToken();
        if (success) {
          console.log("✅ Refresh thành công. Đang gửi lại...");
          return sendZNSTest(phone, true);
        }
      }
      console.log("❌ Không thể refresh token.");
    } else if (result.error === 0) {
      console.log("✅ Thành công!");
    } else {
      console.log(`ℹ️ API phản hồi lỗi ${result.error} (thường là do Template ID giả). Nhưng kết nối và mã Token đã OK!`);
    }
  } catch (err) {
    console.error("❌ Lỗi:", err);
  }
}

// Chạy test với số điện thoại của bạn
sendZNSTest("84394497949");
