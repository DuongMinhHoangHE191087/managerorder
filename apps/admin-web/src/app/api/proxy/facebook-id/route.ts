import { NextRequest, NextResponse } from "next/server";

// Allowed Facebook domains for SSRF protection
const ALLOWED_FB_HOSTS = [
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.com",
  "www.fb.com",
  "web.facebook.com",
];

/**
 * GET /api/proxy/facebook-id?link=<facebook_url>
 * Proxies the traodoisub.com API to get Facebook user ID from a profile URL.
 * Required to avoid CORS issues from browser.
 *
 * Hardening:
 * - URL domain validation (SSRF protection — only Facebook domains)
 * - Safe JSON parsing (handles non-JSON responses)
 * - Specific timeout error handling (504 vs 500)
 * - Response caching (5 min)
 * - Consistent Vietnamese error messages
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const link = searchParams.get("link");

  // Validate: required
  if (!link || !link.trim()) {
    return NextResponse.json({ error: "link parameter is required" }, { status: 400 });
  }

  // Validate: must be a valid URL with allowed Facebook domain
  const trimmedLink = link.trim();
  try {
    const parsed = new URL(trimmedLink);
    if (!ALLOWED_FB_HOSTS.includes(parsed.hostname)) {
      return NextResponse.json(
        { error: "Chỉ chấp nhận link Facebook (facebook.com, fb.com)" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Link không hợp lệ — vui lòng nhập URL đầy đủ (https://...)" },
      { status: 400 }
    );
  }

  try {
    const formData = new URLSearchParams();
    formData.append("link", trimmedLink);

    const res = await fetch("https://id.traodoisub.com/api.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Dịch vụ tra cứu Facebook ID không phản hồi" },
        { status: 502 }
      );
    }

    // Safe JSON parsing — external service may return error HTML
    let data: {
      success?: number;
      id?: string;
      name?: string;
      link?: string;
      code?: number;
    };
    try {
      data = await res.json();
    } catch {
      return NextResponse.json(
        { error: "Phản hồi từ dịch vụ tra cứu không hợp lệ (non-JSON)" },
        { status: 502 }
      );
    }

    if (!data.id) {
      return NextResponse.json(
        { error: "Không thể tra cứu Facebook ID cho link này" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        id: data.id,
        name: data.name ?? null,
        profileUrl: `https://www.facebook.com/${data.id}`,
        originalLink: trimmedLink,
      },
      {
        headers: {
          // Cache successful lookups for 5 minutes
          "Cache-Control": "public, max-age=300, s-maxage=300",
        },
      }
    );
  } catch (err) {
    // Differentiate timeout from other errors
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Hết thời gian kết nối dịch vụ tra cứu (timeout 8s)" },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Lỗi hệ thống khi tra cứu Facebook ID" },
      { status: 500 }
    );
  }
}
