"use client";

import { useEffect, useState } from "react";
import { Bell, Eye, Loader2, MessageSquare, Send, CheckCircle, AlertTriangle } from "lucide-react";
import { appToast } from "@/shared/lib/toast";
import { SectionCard } from "@/shared/ui/section-card";
import { fetcher } from "@/lib/api/fetcher";

interface BotUpcomingReminder {
  id: string;
  orderCode: string;
  productName: string | null;
  expiryDate: string;
  daysLeft: number;
  status: string;
  tier: "T-7" | "T-3" | "T-1" | "EXPIRED";
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  channels: {
    telegram: {
      available: boolean;
      sentToday: boolean;
      contacts: any[];
    };
    zalo: {
      available: boolean;
      sentToday: boolean;
      contacts: any[];
    };
  };
  messageTelegram: string;
  messageZalo: string;
  isConfiguredAuto: boolean;
}

export function BotUpcomingRemindersSection() {
  const [reminders, setReminders] = useState<BotUpcomingReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [previewReminder, setPreviewReminder] = useState<BotUpcomingReminder | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [previewChannel, setPreviewChannel] = useState<"zalo" | "telegram">("zalo");

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const data = await fetcher<BotUpcomingReminder[]>("/api/settings/bot/upcoming-reminders");
      setReminders(data);
    } catch (err: any) {
      appToast.error("Không thể tải danh sách nhắc hẹn sắp tới: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleSendReminder = async (
    reminder: BotUpcomingReminder,
    channel: "zalo" | "telegram",
    customMsg?: string
  ) => {
    const key = `${reminder.id}_${channel}`;
    setSendingId(key);
    try {
      const msgToSend = customMsg || (channel === "zalo" ? reminder.messageZalo : reminder.messageTelegram);
      
      await fetcher("/api/settings/bot/send-reminder", {
        method: "POST",
        body: JSON.stringify({
          orderId: reminder.id,
          channel,
          message: msgToSend,
          tier: reminder.tier,
        }),
      });

      appToast.success(`Đã gửi nhắc nhở thành công qua ${channel.toUpperCase()}`);
      setPreviewReminder(null);
      // Tải lại để cập nhật trạng thái sentToday
      await fetchReminders();
    } catch (err: any) {
      appToast.error(err.message || "Gửi nhắc nhở thất bại");
    } finally {
      setSendingId(null);
    }
  };

  const openPreview = (reminder: BotUpcomingReminder, channel: "zalo" | "telegram") => {
    setPreviewReminder(reminder);
    setPreviewChannel(channel);
    setEditedMessage(channel === "zalo" ? reminder.messageZalo : reminder.messageTelegram);
  };

  return (
    <SectionCard
      title="Lịch nhắc hẹn tự động sắp tới"
      description=""
    >
      <div className="space-y-4">
        {loading ? (
          <div className="py-10 text-center text-sm text-[var(--fg-muted)] animate-pulse">
            Đang quét dữ liệu đơn hàng sắp hết hạn...
          </div>
        ) : reminders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-soft)] p-8 text-center text-sm text-[var(--fg-muted)]">
            Không có đơn hàng nào sắp hết hạn trong 10 ngày tới hoặc tất cả đã được thanh toán.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                  <th className="pb-3 pt-2">Khách hàng</th>
                  <th className="pb-3 pt-2">Đơn hàng / Sản phẩm</th>
                  <th className="pb-3 pt-2">Ngày hết hạn</th>
                  <th className="pb-3 pt-2">Thời gian còn lại</th>
                  <th className="pb-3 pt-2">Kỳ nhắc</th>
                  <th className="pb-3 pt-2">Kênh Zalo</th>
                  <th className="pb-3 pt-2 text-right">Chủ động gửi tin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {reminders.map((reminder) => {
                  const isZaloAvailable = reminder.channels.zalo.available;
                  const isZaloSent = reminder.channels.zalo.sentToday;
                  const isTelegramSent = reminder.channels.telegram.sentToday;

                  let daysBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
                  if (reminder.daysLeft <= 0) {
                    daysBadge = "bg-rose-50 text-rose-700 border border-rose-200/50 font-black animate-pulse";
                  } else if (reminder.daysLeft <= 3) {
                    daysBadge = "bg-amber-50 text-amber-700 border border-amber-200/50";
                  }

                  return (
                    <tr key={reminder.id} className="hover:bg-[var(--surface-light)]/40 transition-colors">
                      <td className="py-3">
                        <div className="font-bold text-[var(--fg-base)]">{reminder.customer.name}</div>
                        {reminder.customer.phone && (
                          <div className="text-[11px] text-[var(--fg-muted)] mt-0.5">{reminder.customer.phone}</div>
                        )}
                      </td>
                      <td className="py-3">
                        <span className="font-mono font-bold text-[var(--fg-muted)]">{reminder.orderCode}</span>
                        <div className="text-[12px] font-semibold text-[var(--fg-base)] truncate max-w-[200px] mt-0.5">
                          {reminder.productName || "Không có sản phẩm"}
                        </div>
                      </td>
                      <td className="py-3 font-medium text-[var(--fg-muted)]">
                        {new Date(reminder.expiryDate).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${daysBadge}`}>
                          {reminder.daysLeft <= 0 ? "Quá hạn" : `${reminder.daysLeft} ngày`}
                        </span>
                      </td>
                      <td className="py-3 font-bold text-[var(--fg-base)]">
                        {reminder.tier}
                      </td>
                      <td className="py-3">
                        {isZaloAvailable ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200/50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            Đã kết nối
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-gray-50 border border-gray-200/50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                            Chưa kết nối
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          {/* Zalo OA Action */}
                          {isZaloAvailable ? (
                            <button
                              onClick={() => openPreview(reminder, "zalo")}
                              disabled={isZaloSent || sendingId === `${reminder.id}_zalo`}
                              className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12px] font-bold transition ${
                                isZaloSent 
                                  ? "bg-slate-50 text-slate-400 border border-slate-200/50" 
                                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                              } disabled:opacity-50`}
                            >
                              {sendingId === `${reminder.id}_zalo` ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : isZaloSent ? (
                                <>
                                  <CheckCircle className="size-3.5" />
                                  Đã gửi
                                </>
                              ) : (
                                <>
                                  <Send className="size-3.5" />
                                  Zalo
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              disabled
                              className="inline-flex items-center gap-1 rounded-xl bg-slate-50 border border-slate-200/30 px-2.5 py-1.5 text-[12px] font-semibold text-slate-350 cursor-not-allowed"
                              title="Khách hàng chưa liên kết tài khoản Zalo"
                            >
                              Không có Zalo
                            </button>
                          )}

                          {/* Telegram Alert Action */}
                          <button
                            onClick={() => openPreview(reminder, "telegram")}
                            disabled={isTelegramSent || sendingId === `${reminder.id}_telegram`}
                            className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12px] font-bold transition ${
                              isTelegramSent 
                                ? "bg-slate-50 text-slate-400 border border-slate-200/50" 
                                : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)] shadow-sm"
                            } disabled:opacity-50`}
                          >
                            {sendingId === `${reminder.id}_telegram` ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : isTelegramSent ? (
                              <>
                                <CheckCircle className="size-3.5" />
                                Đã gửi
                              </>
                            ) : (
                              <>
                                <Bell className="size-3.5" />
                                Telegram
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview and Edit Message Modal */}
      {previewReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border-soft)] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4 mb-4">
              <h3 className="text-base font-black text-[var(--fg-base)] flex items-center gap-2">
                <MessageSquare className="size-5 text-[var(--accent)]" />
                Xem trước tin nhắn nhắc hẹn ({previewChannel.toUpperCase()})
              </h3>
              <button
                type="button"
                onClick={() => setPreviewReminder(null)}
                className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-150">
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <span className="font-semibold text-slate-500 block">Khách hàng</span>
                    <span className="font-bold text-slate-800">{previewReminder.customer.name}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Mã đơn hàng</span>
                    <span className="font-bold text-slate-800 font-mono">{previewReminder.orderCode}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Sản phẩm</span>
                    <span className="font-bold text-slate-800 truncate block">{previewReminder.productName}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Mốc ngày nhắc</span>
                    <span className="font-bold text-slate-800">{previewReminder.tier}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1.5">
                  Nội dung tin nhắn gửi đi
                </label>
                <textarea
                  rows={6}
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[13px] text-emerald-400 focus:border-[var(--accent)] outline-none focus:ring-2 focus:ring-[var(--accent)]/15 resize-none"
                />
                <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                  Bạn có thể chỉnh sửa nội dung tin nhắn này trước khi gửi trực tiếp cho khách hàng.
                </p>
              </div>

              {previewChannel === "telegram" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-amber-800 leading-normal">
                    Lưu ý: Tin nhắn Telegram là thông báo nội bộ gửi về nhóm chat admin của shop, giúp bạn nắm thông tin để tiện liên hệ thủ công.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-[var(--border-soft)] pt-4">
              <button
                type="button"
                onClick={() => setPreviewReminder(null)}
                className="rounded-xl border border-[var(--border-soft)] bg-white px-4 py-2.5 text-[13px] font-bold text-[var(--fg-muted)] transition hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleSendReminder(previewReminder, previewChannel, editedMessage)}
                disabled={sendingId !== null}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-blue-600/20 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingId !== null ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Gửi ngay
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
