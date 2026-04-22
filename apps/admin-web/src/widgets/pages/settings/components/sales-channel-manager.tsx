"use client";

import { useState } from "react";
import { Check, Copy, Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import {
  useCreateSalesChannel,
  useDeleteSalesChannel,
  useSalesChannels,
  useUpdateSalesChannel,
} from "@/widgets/pages/settings/hooks/use-settings";
import type { ShortLinkLandingTemplateKey, ShortLinkResolvedDeliveryMode } from "@/lib/domain/types";

const DELIVERY_MODE_OPTIONS: Array<{ value: ShortLinkResolvedDeliveryMode; label: string }> = [
  { value: "direct_redirect", label: "Chuyển hướng trực tiếp" },
  { value: "landing_page", label: "Qua landing giới thiệu" },
];

const LANDING_TEMPLATE_OPTIONS: Array<{ value: ShortLinkLandingTemplateKey; label: string }> = [
  { value: "owner_intro", label: "Giới thiệu chủ shop" },
  { value: "ctv_neutral", label: "Mẫu CTV trung tính" },
];

type ChannelFormState = {
  name: string;
  defaultDeliveryMode: ShortLinkResolvedDeliveryMode;
  defaultLandingTemplateKey: ShortLinkLandingTemplateKey;
};

export function SalesChannelManager() {
  const { data: channels = [], isLoading } = useSalesChannels();
  const { mutateAsync: createChannel, isPending: creatingChannel } = useCreateSalesChannel();
  const { mutateAsync: updateChannel, isPending: updatingChannel } = useUpdateSalesChannel();
  const { mutateAsync: deleteChannel, isPending: deletingChannel } = useDeleteSalesChannel();

  const [createForm, setCreateForm] = useState<ChannelFormState>({
    name: "",
    defaultDeliveryMode: "direct_redirect",
    defaultLandingTemplateKey: "owner_intro",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ChannelFormState>({
    name: "",
    defaultDeliveryMode: "direct_redirect",
    defaultLandingTemplateKey: "owner_intro",
  });

  async function handleAdd() {
    const name = createForm.name.trim();
    if (!name) {
      appToast.error("Vui lòng nhập tên kênh bán");
      return;
    }

    try {
      const newChannel = await createChannel({
        name,
        defaultDeliveryMode: createForm.defaultDeliveryMode,
        defaultLandingTemplateKey: createForm.defaultLandingTemplateKey,
      });
      setCreateForm({
        name: "",
        defaultDeliveryMode: "direct_redirect",
        defaultLandingTemplateKey: "owner_intro",
      });
      appToast.success(`Đã thêm: ${newChannel.name}`);
    } catch {
      appToast.error("Không thể thêm kênh bán");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteChannel(id);
      appToast.success("Đã xoá kênh bán hàng");
    } catch {
      appToast.error("Không thể xoá kênh bán");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveEdit(id: string) {
    const name = editForm.name.trim();
    if (!name) {
      appToast.error("Vui lòng nhập tên kênh bán");
      return;
    }

    setSavingId(id);
    try {
      await updateChannel({
        id,
        name,
        defaultDeliveryMode: editForm.defaultDeliveryMode,
        defaultLandingTemplateKey: editForm.defaultLandingTemplateKey,
      });
      setEditId(null);
      appToast.success("Đã cập nhật");
    } catch {
      appToast.error("Không thể cập nhật kênh bán");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCopyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      appToast.info(`Đã sao chép ${label}`);
    } catch {
      appToast.error(`Không thể sao chép ${label}`);
    }
  }

  if (isLoading) {
    return <div className="py-4 text-center text-[13px] text-[var(--fg-muted)] animate-pulse">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <ShieldAlert className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wider text-amber-700">Release / runtime note</p>
            <p className="mt-1 text-[13px] leading-6 text-[var(--fg-base)]">
              Kênh bán quyết định policy mặc định cho short-link public. Ở cấp chi tiết vẫn có thể override,
              nhưng nếu không override thì hệ thống sẽ kế thừa từ kênh bán này.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700">
                Default redirect / landing
              </span>
              <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700">
                Template owner / CTV neutral
              </span>
              <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700">
                Override at short-link level
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-white p-4 md:grid-cols-[1.4fr_1fr_1fr_auto]">
        <input
          className="rounded-lg border border-[var(--border-soft)] bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          value={createForm.name}
          onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
          onKeyDown={(event) => event.key === "Enter" && handleAdd()}
          placeholder="Tên kênh bán (VD: Facebook, Zalo, TikTok Shop...)"
        />
        <select
          value={createForm.defaultDeliveryMode}
          onChange={(event) =>
            setCreateForm((current) => ({
              ...current,
              defaultDeliveryMode: event.target.value as ShortLinkResolvedDeliveryMode,
            }))
          }
          className="rounded-lg border border-[var(--border-soft)] bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        >
          {DELIVERY_MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={createForm.defaultLandingTemplateKey}
          onChange={(event) =>
            setCreateForm((current) => ({
              ...current,
              defaultLandingTemplateKey: event.target.value as ShortLinkLandingTemplateKey,
            }))
          }
          className="rounded-lg border border-[var(--border-soft)] bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        >
          {LANDING_TEMPLATE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!createForm.name.trim()}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="size-4" />
          {creatingChannel ? "Đang thêm..." : "Thêm"}
        </button>
      </div>

      <div className="space-y-2">
        {channels.length === 0 ? (
          <p className="py-3 text-center text-[13px] italic text-[var(--fg-muted)]">Chưa có kênh bán hàng nào</p>
        ) : null}

        {channels.map((channel) => (
          <div
            key={channel.id}
            className="group flex flex-col gap-3 rounded-xl border border-[var(--border-soft)] bg-white p-3 transition-colors hover:border-[var(--accent)]/30"
          >
            {editId === channel.id ? (
              <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
                <input
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--accent)]"
                  value={editForm.name}
                  onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                  onKeyDown={(event) => event.key === "Enter" && handleSaveEdit(channel.id)}
                />
                <select
                  value={editForm.defaultDeliveryMode}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      defaultDeliveryMode: event.target.value as ShortLinkResolvedDeliveryMode,
                    }))
                  }
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--accent)]"
                >
                  {DELIVERY_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={editForm.defaultLandingTemplateKey}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      defaultLandingTemplateKey: event.target.value as ShortLinkLandingTemplateKey,
                    }))
                  }
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--accent)]"
                >
                  {LANDING_TEMPLATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button onClick={() => handleSaveEdit(channel.id)} className="text-[var(--accent)] hover:opacity-80">
                  <Check className="size-4" />
                </button>
                <button onClick={() => setEditId(null)} className="text-[var(--fg-muted)] hover:text-[var(--danger)]">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <span className="text-[13px] font-bold text-[var(--fg-base)]">{channel.name}</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {DELIVERY_MODE_OPTIONS.find((option) => option.value === channel.defaultDeliveryMode)?.label ??
                        channel.defaultDeliveryMode}
                    </span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600">
                      {LANDING_TEMPLATE_OPTIONS.find((option) => option.value === channel.defaultLandingTemplateKey)?.label ??
                        channel.defaultLandingTemplateKey}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyValue(channel.id, "ID kênh bán")}
                    title="Sao chép ID kênh bán"
                    className="opacity-0 transition-all group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--accent)]"
                  >
                    <Copy className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditId(channel.id);
                      setEditForm({
                        name: channel.name,
                        defaultDeliveryMode: channel.defaultDeliveryMode,
                        defaultLandingTemplateKey: channel.defaultLandingTemplateKey,
                      });
                    }}
                    className="opacity-0 transition-all group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--accent)]"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(channel.id)}
                    disabled={deletingChannel || deletingId === channel.id || updatingChannel || savingId === channel.id}
                    className="opacity-0 transition-all group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--danger)] disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
