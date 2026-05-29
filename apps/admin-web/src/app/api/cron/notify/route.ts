import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage, formatVnd } from "@/lib/utils/telegram";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const schedule = searchParams.get("schedule") ?? "";
  const origin = new URL(request.url).origin;

  const fetchOptions = {
    method: "GET",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
    },
  };

  try {
    let title = "⚙️ <b>CRON SCHEDULER SYSTEM</b>";
    const lines: string[] = [];
    const todayKey = new Date().toISOString().split("T")[0];

    if (schedule === "daily-01") {
      title = "🌅 <b>CRON ĐẦU NGÀY (08:00 VN)</b>";

      // 1. Order Expiry Reminder
      try {
        const res = await fetch(`${origin}/api/cron/order-expiry-reminder`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          lines.push(`├ ⏰ Nhắc hạn đơn: <b>Gửi ${data.sentCount ?? 0}, bỏ qua ${data.skippedCount ?? 0}</b> / tổng ${data.totalOrders ?? 0}`);
          
          // Chi tiết nhắc hạn đơn
          try {
            const { data: logs } = await supabaseAdmin
              .from("reminder_logs")
              .select("reminder_type, channel, customer_id")
              .gte("sent_at", `${todayKey}T00:00:00`)
              .eq("status", "sent")
              .order("sent_at", { ascending: false })
              .limit(3);
            
            const customerIds = [...new Set(logs?.map(l => l.customer_id).filter(Boolean) || [])];
            if (customerIds.length > 0) {
              const { data: custs } = await supabaseAdmin
                .from("customers")
                .select("id, full_name")
                .in("id", customerIds);
              const nameMap = new Map(custs?.map(c => [c.id, c.full_name]) || []);
              const details = logs?.map(l => {
                const name = nameMap.get(l.customer_id) ?? "Khách hàng";
                return `${name} (${l.channel === "zalo" ? "Zalo" : "Tele"})`;
              }).join(", ");
              lines.push(`│   👤 Đã gửi: <i>${details || "Không có"}</i>`);
            }
          } catch (e) {
            console.error("Error fetching expiry reminder logs detail", e);
          }
        } else {
          lines.push(`├ ⏰ Nhắc hạn đơn: ❌ <i>Lỗi HTTP ${res.status}</i>`);
        }
      } catch (err: any) {
        lines.push(`├ ⏰ Nhắc hạn đơn: ❌ <i>Lỗi: ${err.message}</i>`);
      }

      // 2. Revenue Report (daily)
      try {
        const res = await fetch(`${origin}/api/cron/revenue-report`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          const rev = data.stats?.totalRevenue ?? 0;
          const newOrd = data.stats?.newOrders ?? 0;
          lines.push(`├ 📊 Doanh thu ngày: <b>${formatVnd(rev)}</b> (${newOrd} đơn mới)`);
          lines.push(`│   💳 Đã thanh toán: <b>${data.stats?.paidOrders ?? 0} đơn</b> · Công nợ mới: <b>${formatVnd(data.stats?.newDebt ?? 0)}</b>`);

          // Chi tiết đơn lớn ngày hôm trước
          try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yStr = yesterday.toISOString().split("T")[0];
            const { data: topOrders } = await supabaseAdmin
              .from("orders")
              .select("order_code, total_amount_vnd, customer_id")
              .gte("created_at", `${yStr}T00:00:00`)
              .lte("created_at", `${yStr}T23:59:59`)
              .order("total_amount_vnd", { ascending: false })
              .limit(2);
            
            const ordCustomerIds = [...new Set(topOrders?.map(o => o.customer_id).filter(Boolean) || [])];
            if (ordCustomerIds.length > 0) {
              const { data: custs } = await supabaseAdmin
                .from("customers")
                .select("id, full_name")
                .in("id", ordCustomerIds);
              const nameMap = new Map(custs?.map(c => [c.id, c.full_name]) || []);
              const topList = topOrders?.map(o => {
                const name = nameMap.get(o.customer_id) ?? "Khách";
                return `${o.order_code ?? "Đơn"} (${name}: ${formatVnd(o.total_amount_vnd)})`;
              }).join(", ");
              lines.push(`│   🔝 Đơn lớn: <i>${topList || "Không có"}</i>`);
            }
          } catch (e) {
            console.error("Error fetching top orders detail", e);
          }
        } else {
          lines.push(`├ 📊 Doanh thu ngày: ❌ <i>Lỗi HTTP ${res.status}</i>`);
        }
      } catch (err: any) {
        lines.push(`├ 📊 Doanh thu ngày: ❌ <i>Lỗi: ${err.message}</i>`);
      }

      // 3. Best Super Link
      try {
        const res = await fetch(`${origin}/api/cron/best-super-link`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          lines.push(`├ 🔗 Super Link: <b>Khả dụng ${data.total_available ?? 0}, đã báo ${data.reported ?? 0}</b>`);

          // Chi tiết top super link trống
          try {
            const { data: topLinks } = await supabaseAdmin
              .from("premium_accounts")
              .select("primary_email, total_slots, used_slots")
              .eq("status", "active")
              .not("join_link", "is", null)
              .is("deleted_at", null)
              .order("subscription_expiry_date", { ascending: false })
              .limit(2);
            
            const topList = topLinks?.map(l => {
              const free = l.total_slots - l.used_slots;
              return `${l.primary_email} (trống ${free}/${l.total_slots})`;
            }).join(", ");
            lines.push(`└   🔗 Top trống: <i>${topList || "Hết link khả dụng"}</i>`);
          } catch (e) {
            console.error("Error fetching top links detail", e);
          }
        } else {
          lines.push(`└ 🔗 Super Link: ❌ <i>Lỗi HTTP ${res.status}</i>`);
        }
      } catch (err: any) {
        lines.push(`└ 🔗 Super Link: ❌ <i>Lỗi: ${err.message}</i>`);
      }

    } else if (schedule === "weekly-01") {
      title = "📅 <b>BÁO CÁO DOANH THU TUẦN (Thứ 2 VN)</b>";

      try {
        const res = await fetch(`${origin}/api/cron/revenue-report?type=weekly`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          const rev = data.stats?.totalRevenue ?? 0;
          const newOrd = data.stats?.newOrders ?? 0;
          lines.push(`├ 📅 Doanh thu tuần (${data.dateLabel ?? ""}): <b>${formatVnd(rev)}</b> (${newOrd} đơn mới)`);
          lines.push(`└ 💳 Chi tiết: <b>${data.stats?.paidOrders ?? 0} đơn thanh toán</b> · Công nợ: <b>${formatVnd(data.stats?.newDebt ?? 0)}</b>`);
        } else {
          lines.push(`└ 📅 Doanh thu tuần: ❌ <i>Lỗi HTTP ${res.status}</i>`);
        }
      } catch (err: any) {
        lines.push(`└ 📅 Doanh thu tuần: ❌ <i>Lỗi: ${err.message}</i>`);
      }

    } else if (schedule === "daily-02") {
      title = "☀️ <b>CRON GIỮA NGÀY (09:00 VN)</b>";

      // 1. Auto Escalation
      try {
        const res = await fetch(`${origin}/api/cron/auto-escalation`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          lines.push(`├ ⚡ Escalation: <b>Đã xử lý ${data.processedOrders ?? 0}, chạy ${data.actionsExecuted ?? 0} HĐ</b>`);

          // Chi tiết các chuyển tiếp hôm nay
          try {
            const { data: logs } = await supabaseAdmin
              .from("reminder_logs")
              .select("reminder_type, customer_id")
              .gte("sent_at", `${todayKey}T00:00:00`)
              .eq("status", "sent")
              .like("reminder_type", "escalation_%")
              .limit(3);
            
            const customerIds = [...new Set(logs?.map(l => l.customer_id).filter(Boolean) || [])];
            if (customerIds.length > 0) {
              const { data: custs } = await supabaseAdmin
                .from("customers")
                .select("id, full_name")
                .in("id", customerIds);
              const nameMap = new Map(custs?.map(c => [c.id, c.full_name]) || []);
              const details = logs?.map(l => {
                const name = nameMap.get(l.customer_id) ?? "Khách";
                const action = l.reminder_type.replace("escalation_", "");
                return `${name} (${action})`;
              }).join(", ");
              lines.push(`│   ⚡ Đã chuyển: <i>${details || "Không có"}</i>`);
            }
          } catch (e) {
            console.error("Error fetching escalation logs detail", e);
          }
        } else {
          lines.push(`├ ⚡ Escalation: ❌ <i>Lỗi HTTP ${res.status}</i>`);
        }
      } catch (err: any) {
        lines.push(`├ ⚡ Escalation: ❌ <i>Lỗi: ${err.message}</i>`);
      }

      // 2. Premium Renewal Reminder
      try {
        const res = await fetch(`${origin}/api/cron/premium-renewal-reminder`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          lines.push(`├ ⏳ Nhắc gia hạn Premium: <b>Gửi ${data.sentCount ?? 0}, bỏ qua ${data.skippedCount ?? 0}</b> / tổng ${data.totalSubscriptions ?? 0}`);

          // Chi tiết nhắc gia hạn hôm nay
          try {
            const { data: logs } = await supabaseAdmin
              .from("reminder_logs")
              .select("reminder_type, customer_id")
              .gte("sent_at", `${todayKey}T00:00:00`)
              .eq("status", "sent")
              .like("reminder_type", "premium_renewal:%")
              .limit(3);
            
            const customerIds = [...new Set(logs?.map(l => l.customer_id).filter(Boolean) || [])];
            if (customerIds.length > 0) {
              const { data: custs } = await supabaseAdmin
                .from("customers")
                .select("id, full_name")
                .in("id", customerIds);
              const nameMap = new Map(custs?.map(c => [c.id, c.full_name]) || []);
              const details = logs?.map(l => nameMap.get(l.customer_id) ?? "Khách").join(", ");
              lines.push(`└   ⏳ Đã nhắc: <i>${details || "Không có"}</i>`);
            } else {
              lines.push(`└   ⏳ Đã nhắc: <i>Không có</i>`);
            }
          } catch (e) {
            console.error("Error fetching premium reminder logs detail", e);
            lines.push(`└   ⏳ Đã nhắc: <i>Không có</i>`);
          }
        } else {
          lines.push(`└ ⏳ Nhắc gia hạn Premium: ❌ <i>Lỗi HTTP ${res.status}</i>`);
        }
      } catch (err: any) {
        lines.push(`└ ⏳ Nhắc gia hạn Premium: ❌ <i>Lỗi: ${err.message}</i>`);
      }

    } else if (schedule === "daily-03") {
      title = "🏥 <b>CRON HEALTH CHECK (10:15 VN)</b>";

      try {
        const res = await fetch(`${origin}/api/cron/premium-health-checks`, fetchOptions);
        if (res.ok) {
          const data = await res.json();
          lines.push(`├ 🏥 Premium Health: <b>Xử lý ${data.processed_accounts ?? 0} TK</b> (Check ${data.checked ?? 0}, lỗi ${data.failed ?? 0})`);

          // Chi tiết tài khoản lỗi
          const failedEmails: string[] = [];
          if (data.results) {
            for (const accResult of data.results) {
              if (accResult.results) {
                for (const item of accResult.results) {
                  if (item.status === "error") {
                    failedEmails.push(item.email || item.premium_account_id);
                  }
                }
              }
            }
          }
          if (failedEmails.length > 0) {
            lines.push(`└   🔴 Lỗi kiểm tra: <i>${failedEmails.join(", ")}</i>`);
          } else {
            lines.push(`└   ✅ Trạng thái: <i>100% tài khoản hoạt động ổn định</i>`);
          }
        } else {
          lines.push(`└ 🏥 Premium Health: ❌ <i>Lỗi HTTP ${res.status}</i>`);
        }
      } catch (err: any) {
        lines.push(`└ 🏥 Premium Health: ❌ <i>Lỗi: ${err.message}</i>`);
      }

    } else {
      return NextResponse.json({ error: `Invalid schedule: ${schedule}` }, { status: 400 });
    }

    // Get time in Asia/Ho_Chi_Minh
    const formatter = new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const formattedTime = formatter.format(new Date()) + " (VN)";

    const message = [
      title,
      `⏰ <b>Thời gian:</b> ${formattedTime}`,
      `📋 <b>Trigger:</b> ${schedule}`,
      `━━━━━━━━━━━━━━━━━━━`,
      `📊 <b>KẾT QUẢ THỰC THI:</b>`,
      ...lines,
      `━━━━━━━━━━━━━━━━━━━`,
      `💡 <i>Hệ thống tự động vận hành an toàn</i>`
    ].join("\n");

    const sent = await sendTelegramMessage(message);

    return NextResponse.json({
      success: !!sent,
      schedule,
      timestamp: new Date().toISOString(),
      details: lines,
    });
  } catch (error: any) {
    console.error("[Cron notify error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
