"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Link2, LockKeyhole, MessageCircle, Sparkles } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import type { SalesLandingOfferConfig, ShortLinkFailureTemplateKey } from "@/lib/domain/types";
import { useProducts } from "@/widgets/pages/products/hooks/use-products";
import { useShortLinks } from "@/widgets/pages/short-links/hooks/use-short-links";
import { useSystemSettings, useUpdateSystemSettings } from "@/widgets/pages/settings/hooks/use-settings";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/settings/system-settings";
import {
  DEFAULT_SALES_LANDING_CONFIG,
  buildSalesLandingConfigFromProducts,
  formatMarketingPrice,
} from "@/lib/settings/sales-landing";
import { PREMIUM_OFFERS } from "@/widgets/marketing/sales-landing-config";

const FAILURE_TEMPLATE_OPTIONS: Array<{ value: ShortLinkFailureTemplateKey; label: string; desc: string }> = [
  {
    value: "customer_offer_wall",
    label: "Landing quảng cáo cho khách",
    desc: "Hiện offer cards và CTA mua hàng khi link hết hạn hoặc không mở được.",
  },
  {
    value: "seller_unlock_request",
    label: "CTV xin người bán mở lại",
    desc: "Không hiện quảng cáo, chỉ hướng dẫn liên hệ người bán để mở lại link.",
  },
];

export function SalesLandingManager() {
  const { data, isLoading } = useSystemSettings();
  const { data: products = [] } = useProducts();
  const { data: shortLinks = [] } = useShortLinks();
  const { mutateAsync: updateSettings } = useUpdateSystemSettings();

  const [settings, setSettings] = useState(DEFAULT_SYSTEM_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }

    setSettings({
      ...data,
      sales_landing_config: buildSalesLandingConfigFromProducts(products, data.sales_landing_config),
    });
  }, [data, products]);

  const offers = useMemo(
    () => settings.sales_landing_config.offers,
    [settings.sales_landing_config.offers],
  );
  const activeShortLinks = useMemo(
    () => shortLinks.filter((link) => link.status === "active"),
    [shortLinks],
  );

  function updateOffer(index: number, updater: (offer: SalesLandingOfferConfig) => SalesLandingOfferConfig) {
    setSettings((current) => {
      const nextOffers = [...current.sales_landing_config.offers];
      nextOffers[index] = updater(nextOffers[index] ?? DEFAULT_SALES_LANDING_CONFIG.offers[index]);
      return {
        ...current,
        sales_landing_config: { ...current.sales_landing_config, offers: nextOffers },
      };
    });
  }

  function updateFailureDefaults(
    updater: (current: typeof DEFAULT_SALES_LANDING_CONFIG.shortLinkFailureDefaults) => typeof DEFAULT_SALES_LANDING_CONFIG.shortLinkFailureDefaults,
  ) {
    setSettings((current) => ({
      ...current,
      sales_landing_config: {
        ...current.sales_landing_config,
        shortLinkFailureDefaults: updater(current.sales_landing_config.shortLinkFailureDefaults),
      },
    }));
  }

  function applyProduct(index: number, productId: string) {
    if (!productId) {
      updateOffer(index, () => DEFAULT_SALES_LANDING_CONFIG.offers[index]);
      return;
    }

    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    updateOffer(index, (offer) => ({
      ...offer,
      product_id: product.id,
      label: product.name,
      price: formatMarketingPrice(product.sellPriceVnd, product.durationValue, product.durationType),
      desc: offer.desc || DEFAULT_SALES_LANDING_CONFIG.offers[index].desc,
      }));
  }

  function applyShortLink(index: number, slug: string) {
    if (!slug) {
      return;
    }

    updateOffer(index, (offer) => ({
      ...offer,
      href: `/s/${slug}`,
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings(settings);
      appToast.success("Đã lưu cấu hình landing công khai");
    } catch (error) {
      appToast.error(error instanceof Error ? error.message : "Lỗi khi lưu cấu hình landing");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <div className="py-4 text-center text-[13px] text-[var(--fg-muted)] animate-pulse">Đang tải...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-soft)] bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold uppercase tracking-wider text-indigo-700">Release / runtime note</p>
            <p className="mt-1 text-[13px] leading-6 text-[var(--fg-base)]">
              4 card bên dưới sẽ hiển thị trên trang landing công khai, trang lỗi và trang hết hạn link.
              Mỗi card lấy tiêu đề, giá và mô tả từ snapshot bạn chọn trong cài đặt.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                Chọn sản phẩm
              </span>
              <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                Tuỳ chỉnh link
              </span>
              <span className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                Snapshot theo settings
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm xl:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent)]">
                Public link templates
              </p>
              <h4 className="mt-1 text-[17px] font-black text-[var(--fg-base)]">
                Mặc định khi short-link hết hạn hoặc không tồn tại
              </h4>
              <p className="mt-1 max-w-2xl text-[13px] leading-6 text-[var(--fg-muted)]">
                Link cụ thể và kênh bán có thể override. Slug 404 không có record nên luôn dùng cấu hình mặc định này.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              /s/[slug] failure
            </span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                Template mặc định
              </span>
              <Select
                value={settings.sales_landing_config.shortLinkFailureDefaults.defaultTemplateKey}
                onChange={(event) =>
                  updateFailureDefaults((current) => ({
                    ...current,
                    defaultTemplateKey: event.target.value as ShortLinkFailureTemplateKey,
                  }))
                }
                className="h-11 w-full rounded-xl text-[13px] font-medium"
              >
                {FAILURE_TEMPLATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                {FAILURE_TEMPLATE_OPTIONS.find((option) => option.value === settings.sales_landing_config.shortLinkFailureDefaults.defaultTemplateKey)?.desc}
              </p>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                CTA mua hàng cho khách thường
              </span>
              <Input
                value={settings.sales_landing_config.shortLinkFailureDefaults.customerOfferCtaHref}
                onChange={(event) =>
                  updateFailureDefaults((current) => ({
                    ...current,
                    customerOfferCtaHref: event.target.value,
                  }))
                }
                placeholder="https://duongminhhoang.store"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                Nội dung CTV khi link hết hạn
              </span>
              <Input
                value={settings.sales_landing_config.shortLinkFailureDefaults.sellerUnlockMessage}
                onChange={(event) =>
                  updateFailureDefaults((current) => ({
                    ...current,
                    sellerUnlockMessage: event.target.value,
                  }))
                }
                placeholder="Link này đã hết hạn. Hãy gửi yêu cầu đến người bán để mở lại."
              />
            </label>
          </div>

          <ShortLinkFailurePreview
            templateKey={settings.sales_landing_config.shortLinkFailureDefaults.defaultTemplateKey}
            customerOfferCtaHref={settings.sales_landing_config.shortLinkFailureDefaults.customerOfferCtaHref}
            sellerUnlockMessage={settings.sales_landing_config.shortLinkFailureDefaults.sellerUnlockMessage}
          />
        </div>

        {offers.map((offer, index) => {
          const style = PREMIUM_OFFERS[index] ?? PREMIUM_OFFERS[0];

          return (
            <div key={`${index}-${style.label}`} className="rounded-2xl border border-[var(--border-soft)] bg-white p-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br ${style.gradient} shadow-inner`}
                >
                  <style.icon className="size-6 text-white" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
                      Slot {index + 1}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-700">
                      {style.tag}
                    </span>
                  </div>
                  <h4 className="mt-1 text-[15px] font-black tracking-tight text-[var(--fg-base)]">
                    {offer.label || style.label}
                  </h4>
                  <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                    {offer.price || style.price}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    Sản phẩm hiển thị
                  </label>
                  <Select
                    value={offer.product_id ?? ""}
                    onChange={(event) => applyProduct(index, event.target.value)}
                    className="h-11 w-full rounded-xl text-[13px] font-medium"
                  >
                    <option value="">Dùng nội dung mặc định</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {formatMarketingPrice(product.sellPriceVnd, product.durationValue, product.durationType)}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    Link hiển thị
                  </label>
                  <Input
                    value={offer.href}
                    onChange={(event) =>
                      updateOffer(index, (current) => ({
                        ...current,
                        href: event.target.value,
                      }))
                    }
                    placeholder="https://... hoặc /s/slug"
                  />
                  <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                    Có thể dán URL thật hoặc chọn một short-link đang hoạt động bên dưới để tránh rơi sang trang 404.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    Chọn short-link có sẵn
                  </label>
                  <Select
                    value={offer.href.match(/^\/s\/([^/?#]+)(?:[?#].*)?$/)?.[1] ?? ""}
                    onChange={(event) => applyShortLink(index, event.target.value)}
                    className="h-11 w-full rounded-xl text-[13px] font-medium"
                  >
                    <option value="">Nhập link thủ công</option>
                    {activeShortLinks.map((link) => (
                      <option key={link.id} value={link.slug}>
                        {(link.title || link.slug) + ` · /s/${link.slug}`}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                    Link này sẽ được chèn vào landing dưới dạng short-link nội bộ đang hoạt động.
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-light)] p-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--fg-muted)]">
                    <Link2 className="size-3.5 text-[var(--accent)]" />
                    Preview
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-[14px] font-black text-[var(--fg-base)]">{offer.label || style.label}</p>
                    <p className="text-[13px] font-semibold text-[var(--accent)]">{offer.price || style.price}</p>
                    <p className="text-[12px] leading-6 text-[var(--fg-muted)]">{offer.desc || style.desc}</p>
                    <p className="truncate text-[11px] text-[var(--fg-muted)]">{offer.href || style.href}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="min-w-32">
          {saving ? "Đang lưu..." : "Lưu landing"}
        </Button>
      </div>
    </div>
  );
}

function ShortLinkFailurePreview({
  templateKey,
  customerOfferCtaHref,
  sellerUnlockMessage,
}: {
  templateKey: ShortLinkFailureTemplateKey;
  customerOfferCtaHref: string;
  sellerUnlockMessage: string;
}) {
  const isSellerTemplate = templateKey === "seller_unlock_request";

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-slate-950 text-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-lime-200">
            Preview trang lỗi short-link
          </p>
          <p className="mt-1 text-[12px] text-slate-300">
            Khách cuối sẽ thấy màn này khi link hết hạn, bị khóa, quá lượt hoặc sai token.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
          {isSellerTemplate ? "CTV unlock" : "Offer wall"}
        </span>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.07] p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-300 to-emerald-600 text-slate-950">
            {isSellerTemplate ? <LockKeyhole className="size-7" /> : <Sparkles className="size-7" />}
          </div>
          <p className="mt-5 text-[11px] font-black uppercase tracking-[0.2em] text-lime-300">
            Link không mở được
          </p>
          <h5 className="mt-3 text-2xl font-black tracking-tight">
            {isSellerTemplate
              ? sellerUnlockMessage || "Hãy liên hệ người bán để mở lại link."
              : "Link đã hết hạn, nhưng khách vẫn có thể chuyển sang trang mua hàng chính hãng."}
          </h5>
          <p className="mt-3 text-[13px] leading-6 text-slate-300">
            {isSellerTemplate
              ? "Mẫu này tránh quảng cáo ở luồng CTV và tập trung vào hành động liên hệ người bán."
              : "Mẫu này giữ khách ở lại hệ sinh thái bán hàng bằng CTA mua hàng và các offer đang cấu hình."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={customerOfferCtaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-28 flex-col justify-between rounded-[24px] border border-lime-300/20 bg-lime-300/10 p-4 text-lime-50 transition-transform hover:-translate-y-0.5"
          >
            <span className="text-[11px] font-black uppercase tracking-wider text-lime-200">CTA khách thường</span>
            <span className="mt-4 break-all text-sm font-bold">{customerOfferCtaHref}</span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-black">
              Mở CTA
              <ExternalLink className="size-3.5" />
            </span>
          </a>
          <div className="flex min-h-28 flex-col justify-between rounded-[24px] border border-white/10 bg-white/[0.07] p-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">Hỗ trợ</span>
            <span className="mt-4 text-sm font-bold">
              {isSellerTemplate ? "Ưu tiên link liên hệ người bán trên từng short-link/kênh bán." : "Hiện offer cards và nút tư vấn nhanh."}
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-black text-sky-200">
              <MessageCircle className="size-3.5" />
              Luồng hỗ trợ rõ ràng
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
