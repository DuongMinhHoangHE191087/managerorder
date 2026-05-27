"use client";

import { useState } from "react";
import { Check, Copy, Pencil, ShieldAlert, Trash2, X } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import {
  AdvancedOptionsDisclosure,
  CreateActionFooter,
  CreateFormSection,
} from "@/shared/ui/create-flow-shell";
import {
  useCreateSalesChannel,
  useDeleteSalesChannel,
  useSalesChannels,
  useUpdateSalesChannel,
} from "@/widgets/pages/settings/hooks/use-settings";
import type {
  ShortLinkFailureTemplateKey,
  ShortLinkLandingTemplateKey,
  ShortLinkResolvedDeliveryMode,
} from "@/lib/domain/types";

const DELIVERY_MODE_OPTIONS: Array<{ value: ShortLinkResolvedDeliveryMode; label: string }> = [
  { value: "direct_redirect", label: "Chuyển hướng trực tiếp" },
  { value: "landing_page", label: "Qua landing giới thiệu" },
];

const LANDING_TEMPLATE_OPTIONS: Array<{ value: ShortLinkLandingTemplateKey; label: string }> = [
  { value: "owner_intro", label: "Giới thiệu chủ shop" },
  { value: "ctv_neutral", label: "Mẫu CTV trung tính" },
];

const FAILURE_TEMPLATE_OPTIONS: Array<{ value: ShortLinkFailureTemplateKey; label: string }> = [
  { value: "customer_offer_wall", label: "Khách thường: landing mua hàng" },
  { value: "seller_unlock_request", label: "CTV: xin người bán mở lại" },
];

type ChannelFormState = {
  name: string;
  defaultDeliveryMode: ShortLinkResolvedDeliveryMode;
  defaultLandingTemplateKey: ShortLinkLandingTemplateKey;
  defaultFailureTemplateKey: ShortLinkFailureTemplateKey;
  sellerContactUrl: string;
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
    defaultFailureTemplateKey: "customer_offer_wall",
    sellerContactUrl: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ChannelFormState>({
    name: "",
    defaultDeliveryMode: "direct_redirect",
    defaultLandingTemplateKey: "owner_intro",
    defaultFailureTemplateKey: "customer_offer_wall",
    sellerContactUrl: "",
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
        defaultFailureTemplateKey: createForm.defaultFailureTemplateKey,
        sellerContactUrl: createForm.sellerContactUrl.trim() || null,
      });
      setCreateForm({
        name: "",
        defaultDeliveryMode: "direct_redirect",
        defaultLandingTemplateKey: "owner_intro",
        defaultFailureTemplateKey: "customer_offer_wall",
        sellerContactUrl: "",
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
        defaultFailureTemplateKey: editForm.defaultFailureTemplateKey,
        sellerContactUrl: editForm.sellerContactUrl.trim() || null,
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

      <CreateFormSection
        title="Tạo kênh bán mới"
        description="Giữ create panel gọn: tên kênh, delivery mặc định và failure template là đủ để vận hành nhanh. Các override hiếm dùng được gom xuống phần nâng cao."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Tên kênh bán
            </label>
            <Input
              value={createForm.name}
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleAdd();
                }
              }}
              placeholder="Tên kênh bán (VD: Facebook, Zalo, TikTok Shop...)"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Delivery mặc định
            </label>
            <Select
              value={createForm.defaultDeliveryMode}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  defaultDeliveryMode: event.target.value as ShortLinkResolvedDeliveryMode,
                }))
              }
              className="h-12"
            >
              {DELIVERY_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Failure template mặc định
            </label>
            <Select
              value={createForm.defaultFailureTemplateKey}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  defaultFailureTemplateKey: event.target.value as ShortLinkFailureTemplateKey,
                }))
              }
              className="h-12"
            >
              {FAILURE_TEMPLATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </CreateFormSection>

      <AdvancedOptionsDisclosure title="Template public link nâng cao">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Landing template mặc định
            </label>
            <Select
              value={createForm.defaultLandingTemplateKey}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  defaultLandingTemplateKey: event.target.value as ShortLinkLandingTemplateKey,
                }))
              }
              className="h-12"
            >
              {LANDING_TEMPLATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--fg-muted)]">
              Link liên hệ người bán
            </label>
            <Input
              className="h-12"
              value={createForm.sellerContactUrl}
              onChange={(event) => setCreateForm((current) => ({ ...current, sellerContactUrl: event.target.value }))}
              placeholder="https://zalo.me/... hoặc link hỗ trợ"
            />
          </div>
        </div>
      </AdvancedOptionsDisclosure>

      <CreateActionFooter
        primaryLabel="Thêm kênh bán"
        onPrimary={() => void handleAdd()}
        pending={creatingChannel}
        disabled={!createForm.name.trim()}
      />

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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1.2fr_auto_auto]">
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
                <select
                  value={editForm.defaultFailureTemplateKey}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      defaultFailureTemplateKey: event.target.value as ShortLinkFailureTemplateKey,
                    }))
                  }
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--accent)]"
                >
                  {FAILURE_TEMPLATE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-app)] px-3 py-1.5 text-[13px] font-medium outline-none focus:border-[var(--accent)]"
                  value={editForm.sellerContactUrl}
                  onChange={(event) => setEditForm((current) => ({ ...current, sellerContactUrl: event.target.value }))}
                  placeholder="Link liên hệ"
                />
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
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                      {FAILURE_TEMPLATE_OPTIONS.find((option) => option.value === channel.defaultFailureTemplateKey)?.label ??
                        channel.defaultFailureTemplateKey}
                    </span>
                    {channel.sellerContactUrl ? (
                      <span className="rounded-full bg-lime-50 px-2.5 py-1 text-[11px] font-semibold text-lime-700">
                        Có link người bán
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyValue(channel.id, "ID kênh bán")}
                    title="Sao chép ID kênh bán"
                    className="opacity-0 transition-[background-color,border-color,box-shadow,color,opacity,transform,width] group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--accent)]"
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
                        defaultFailureTemplateKey: channel.defaultFailureTemplateKey,
                        sellerContactUrl: channel.sellerContactUrl ?? "",
                      });
                    }}
                    className="opacity-0 transition-[background-color,border-color,box-shadow,color,opacity,transform,width] group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--accent)]"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(channel.id)}
                    disabled={deletingChannel || deletingId === channel.id || updatingChannel || savingId === channel.id}
                    className="opacity-0 transition-[background-color,border-color,box-shadow,color,opacity,transform,width] group-hover:opacity-100 text-[var(--fg-muted)] hover:text-[var(--danger)] disabled:opacity-40"
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
