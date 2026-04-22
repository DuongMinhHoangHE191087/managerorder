"use client";

import dynamic from "next/dynamic";
import { use, useState, useRef } from "react";
import { 
  ArrowLeft, Edit2, ShieldAlert, Trash2, 
  Server, Clock, Link2, Calendar, 
  Plus, Save, ShieldCheck,
  Info, Loader2, Eye, EyeOff, Copy, Check
} from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { useRouter } from "next/navigation";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { Modal } from "@/shared/ui/modal";
import { Button } from "@/shared/ui/button";
import { vi } from "@/shared/messages/vi";

import {
  useDeleteSourceAccount,
  useSourceAccount,
  useSourceAccountDecrypt,
  useUpdateSourceAccount,
} from "@/widgets/pages/inventory/hooks/use-source-accounts";
import { useProducts } from "@/widgets/pages/products/hooks/use-products";
import { useProviders } from "@/widgets/pages/providers/hooks/use-providers";
import { formatDateLabel, formatRelativeTime, cn } from "@/lib/utils";
import type { SourceAccount } from "@/lib/domain/types";

const sourceAccountText = vi.inventory.sourceAccountDetail;

function AsyncPanelFallback({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-light)]/40 p-6 text-[13px] font-medium text-[var(--fg-muted)]">
      <Loader2 className="mr-2 size-4 animate-spin text-[var(--accent)]" />
      {sourceAccountText.loadingSection(label)}
    </div>
  );
}

const SlotBreakdownCard = dynamic(
  () =>
    import("@/widgets/pages/inventory/components/slot-breakdown-card").then((mod) => ({
      default: mod.SlotBreakdownCard,
    })),
  {
    loading: () => <AsyncPanelFallback label="phân tích slot" />,
  }
);

const SourceAccountConnections = dynamic(
  () =>
    import("@/widgets/pages/inventory/components/source-account-connections").then((mod) => ({
      default: mod.SourceAccountConnections,
    })),
  {
    loading: () => <AsyncPanelFallback label="kết nối" />,
  }
);

const SourceAccountConnectionDetailsPanel = dynamic(
  () =>
    import("@/widgets/pages/inventory/components/source-account-connection-details").then((mod) => ({
      default: mod.SourceAccountConnectionDetailsPanel,
    })),
  {
    loading: () => <AsyncPanelFallback label="chi tiết kết nối" />,
  }
);

const DuolingoFamilyPanel = dynamic(
  () =>
    import("@/widgets/pages/inventory/components/duolingo-family-panel").then((mod) => ({
      default: mod.DuolingoFamilyPanel,
    })),
  {
    loading: () => <AsyncPanelFallback label="Gia đình Duolingo" />,
  }
);

const EditSourceAccountModal = dynamic(
  () =>
    import("@/widgets/pages/inventory/components/create-source-account-modal").then((mod) => ({
      default: mod.EditSourceAccountModal,
    })),
  {
    ssr: false,
  }
);

const ActivityTimeline = dynamic(
  () =>
    import("@/widgets/pages/activity-logs/components/activity-timeline").then((mod) => ({
      default: mod.ActivityTimeline,
    })),
  {
    loading: () => <AsyncPanelFallback label="lịch sử hoạt động" />,
  }
);


export default function SourceAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  const { data: account, isLoading, error } = useSourceAccount(id);
  const { data: products = [] } = useProducts();
  const { data: providers = [] } = useProviders();
  const { mutateAsync: deleteSourceAccount } = useDeleteSourceAccount();
  const { mutateAsync: updateSourceAccount } = useUpdateSourceAccount();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState<{key: string, value: string}[]>([]);
  const [connTab, setConnTab] = useState<"manage" | "detail" | "family">("manage");
  const connectionsRef = useRef<HTMLDivElement>(null);
  const reservedRef = useRef<HTMLDivElement>(null);

  // Decrypt state
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const decryptQuery = useSourceAccountDecrypt(id, showDecrypted);

  // Reuse shared EditSourceAccountModal — pass account object to open, null to close
  const [editingAccount, setEditingAccount] = useState<SourceAccount | null>(null);

  const handleEditSubmit = async (body: { id: string; email: string; provider: string; productIds: string[]; maxSlots: number; expiresAt: string; credentials?: Array<{ type: string; value: string; label?: string }>; purchaseCostVnd?: number; purchaseDate?: string; purchaseSource?: string }) => {
    await updateSourceAccount(body as Parameters<typeof updateSourceAccount>[0]);
  };

  const handleEditNotesClick = () => {
    if (account?.notes) {
      setEditedNotes(Object.entries(account.notes).map(([k, v]) => ({ key: k, value: String(v) })));
    } else {
      setEditedNotes([]);
    }
    setIsEditingNotes(true);
  };

  const productMap = new Map(products.map(p => [p.id, p.name]));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4 text-[var(--fg-muted)]">
            <div className="size-8 border-4 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin"></div>
            <p className="text-[13px] font-medium tracking-wide">{sourceAccountText.loading}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !account) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="size-16 bg-[var(--danger)]/10 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="size-8 text-[var(--danger)]" />
            </div>
              <h2 className="text-xl font-bold text-[var(--fg-base)]">{sourceAccountText.notFoundTitle}</h2>
              <p className="text-[14px] text-[var(--fg-muted)]">{sourceAccountText.notFoundDescription}</p>
            <Button variant="secondary" onClick={() => router.push("/inventory")} className="mt-4">
              <ArrowLeft className="size-4 mr-2" />
                {sourceAccountText.backToList}
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const isFull = account.usedSlots >= account.maxSlots;

  const handleDelete = async () => {
    try {
      await deleteSourceAccount(account.id);
      appToast.success(sourceAccountText.deleteSuccess);
      router.push("/inventory");
    } catch {
      appToast.error(sourceAccountText.deleteError);
    }
  };

  const handleSaveNotes = async () => {
    try {
      const newNotes = editedNotes.reduce((acc, { key, value }) => {
        if (key.trim() && value.trim()) acc[key.trim()] = value.trim();
        return acc;
      }, {} as Record<string, string>);
      await updateSourceAccount({ id: account.id, notes: newNotes });
      setIsEditingNotes(false);
      appToast.success(sourceAccountText.updateNotesSuccess);
    } catch (err: unknown) {
      appToast.error(err instanceof Error ? err.message : sourceAccountText.updateNotesError);
    }
  };

  const handleAddNote = () => setEditedNotes([...editedNotes, { key: "", value: "" }]);
  
  const handleUpdateNote = (index: number, field: 'key'|'value', val: string) => {
    const newNotes = [...editedNotes];
    newNotes[index][field] = val;
    setEditedNotes(newNotes);
  };
  
  const handleRemoveNote = (index: number) => {
    const newNotes = [...editedNotes];
    newNotes.splice(index, 1);
    setEditedNotes(newNotes);
  };

  const handleToggleDecrypt = () => {
    if (showDecrypted) {
      setShowDecrypted(false);
      setCopiedField(null);
      return;
    }
    setShowDecrypted(true);
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    appToast.success(sourceAccountText.copied);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <AppLayout>
      <PageContainer className="relative pb-20">
        
        {/* Modern Header */}
        <div className="app-card sticky top-0 z-40 mb-8 border border-[var(--border-soft)] bg-[rgba(255,255,255,0.88)] px-4 py-4 shadow-[0_18px_44px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push("/inventory")}
                className="size-10 rounded-full flex items-center justify-center bg-[var(--surface-light)] border border-[var(--border-soft)] hover:bg-[var(--surface-strong)] transition-colors active:scale-95"
              >
                <ArrowLeft className="size-5 text-[var(--fg-base)]" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black tracking-tight text-[var(--fg-base)] sm:text-3xl">{sourceAccountText.title}</h1>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                    isFull ? "bg-[var(--danger)]/10 text-[var(--danger)]" : "bg-[var(--accent)]/10 text-[var(--accent)]"
                  }`}>
                    <span className={`size-1.5 rounded-full ${isFull ? "bg-[var(--danger)]" : "bg-[var(--accent)] animate-pulse"}`}></span>
                    {isFull ? sourceAccountText.full : sourceAccountText.active}
                  </span>
                </div>
                <p className="text-[14px] text-[var(--fg-muted)] mt-1 font-medium">{account.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                setEditingAccount(account);
              }}
                className="flex items-center gap-2 rounded-[1rem] border border-[var(--border-soft)] bg-[var(--surface-light)] px-4 py-2 text-[13px] font-bold text-[var(--fg-base)] shadow-sm transition-colors hover:bg-[var(--surface-strong)] active:scale-[0.98]"
              >
                <Edit2 className="size-4" /> {sourceAccountText.editConfig}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleting(true)}
                className="flex items-center gap-2 rounded-[1rem] border border-[var(--danger)]/30 bg-white px-4 py-2 text-[13px] font-bold text-[var(--danger)] shadow-sm transition-colors hover:bg-[var(--danger)]/10"
              >
                <Trash2 className="size-4" /> {sourceAccountText.delete}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* CỘT TRÁI (Overview & Stats) */}
          <div className="lg:col-span-4 space-y-6">
            <div>
              <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] p-6">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)]">
                      <Server className="size-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{sourceAccountText.provider}</p>
                      <p className="text-[16px] font-black text-[var(--fg-base)] tracking-tight">
                        {providers.find(p => p.id === account.provider)?.name || account.provider}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider mb-2">{sourceAccountText.supportedProducts}</p>
                      <div className="flex flex-wrap gap-2">
                        {account.productIds.map(pid => (
                          <span key={pid} className="inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-bold bg-[var(--bg-app)] border border-[var(--border-soft)] text-[var(--fg-base)]">
                            {productMap.get(pid) || pid}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* SlotBreakdownCard replaces basic progress bar */}
                <div className="bg-[var(--surface-light)]/30 p-4">
                  <SlotBreakdownCard
                    sourceAccountId={account.id}
                    onScrollToConnections={() => connectionsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    onScrollToReserved={() => reservedRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="app-card relative overflow-hidden border border-indigo-500/20 bg-[linear-gradient(135deg,rgba(79,70,229,0.08),rgba(168,85,247,0.08))] p-6 shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <div className="absolute -right-6 -top-6 text-indigo-500/20 rotate-12">
                  <Clock className="size-32" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="size-4 text-indigo-600" />
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">{sourceAccountText.expiryTitle}</p>
                  </div>
                  <p className="text-[24px] font-black text-[var(--fg-base)] tracking-tight">
                    {formatDateLabel(account.expiresAt)}
                  </p>
                  <p className="text-[13px] font-medium text-[var(--fg-muted)] mt-1">
                    {formatRelativeTime(account.expiresAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes & Credentials Section */}
            <div>
              <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] p-6">
                  <h3 className="text-[16px] font-black text-[var(--fg-base)] flex items-center gap-2 tracking-tight">
                    <ShieldCheck className="size-5 text-[var(--accent)]" /> {sourceAccountText.notesTitle}
                  </h3>
                  <div className="flex items-center gap-2">
                    {!isEditingNotes && (
                      <button
                        type="button"
                        onClick={handleToggleDecrypt}
                        className={`text-[12px] font-bold text-amber-600 hover:underline flex items-center gap-1 ${decryptQuery.isFetching ? 'opacity-50' : ''}`}
                      >
                        {decryptQuery.isFetching ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : showDecrypted ? (
                          <EyeOff className="size-3" />
                        ) : (
                          <Eye className="size-3" />
                        )}
                        {showDecrypted ? sourceAccountText.hidePassword : sourceAccountText.showPassword}
                      </button>
                    )}
                    {!isEditingNotes ? (
                      <button
                        type="button"
                        onClick={handleEditNotesClick}
                        className="text-[12px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
                      >
                        <Edit2 className="size-3" /> {sourceAccountText.editNotes}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsEditingNotes(false)}
                          className="text-[12px] font-bold text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                        >
                          {sourceAccountText.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNotes}
                          className="text-[12px] font-bold text-white bg-[var(--accent)] px-3 py-1 rounded-md flex items-center gap-1 hover:brightness-110"
                        >
                          <Save className="size-3" /> {sourceAccountText.save}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  {/* Decrypted password section */}
                  {showDecrypted && decryptQuery.isLoading && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="size-3" /> {sourceAccountText.decryptedTitle}
                      </p>
                      <div className="flex items-center gap-2 text-[12px] text-amber-700">
                        <Loader2 className="size-3 animate-spin" />
                        {sourceAccountText.loading}
                      </div>
                    </div>
                  )}
                  {showDecrypted && decryptQuery.isError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[12px] font-medium text-red-700">
                      {sourceAccountText.decryptError}
                    </div>
                  )}
                  {showDecrypted && decryptQuery.data && !decryptQuery.isLoading && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                      <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="size-3" /> {sourceAccountText.decryptedTitle}
                      </p>
                      <div className="flex items-center gap-2 rounded-lg border border-amber-200/50 bg-white p-2">
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase">{sourceAccountText.email}</span>
                          <p className="text-[14px] font-mono font-bold text-[var(--fg-base)] break-all">{decryptQuery.data.email}</p>
                        </div>
                        <button onClick={() => handleCopy(decryptQuery.data.email, 'email')} className="size-8 flex items-center justify-center rounded-lg hover:bg-amber-100 transition-colors">
                          {copiedField === 'email' ? <Check className="size-4 text-green-500" /> : <Copy className="size-4 text-[var(--fg-muted)]" />}
                        </button>
                      </div>
                      {decryptQuery.data.password && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200/50 bg-white p-2">
                          <div className="flex-1">
                            <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase">{sourceAccountText.password}</span>
                            <p className="text-[14px] font-mono font-bold text-[var(--fg-base)] break-all">{decryptQuery.data.password}</p>
                          </div>
                          <button onClick={() => handleCopy(decryptQuery.data.password!, 'password')} className="size-8 flex items-center justify-center rounded-lg hover:bg-amber-100 transition-colors">
                            {copiedField === 'password' ? <Check className="size-4 text-green-500" /> : <Copy className="size-4 text-[var(--fg-muted)]" />}
                          </button>
                        </div>
                      )}
                      {decryptQuery.data.credentials?.length > 0 && (
                        decryptQuery.data.credentials.map((cred) => (
                          <div key={cred.id} className="flex items-center gap-2 rounded-lg border border-amber-200/50 bg-white p-2">
                            <div className="flex-1">
                              <span className="text-[10px] font-bold text-[var(--fg-muted)] uppercase">{cred.label?.trim() || cred.type}</span>
                              <p className="text-[14px] font-mono font-bold text-[var(--fg-base)] break-all">{cred.value}</p>
                            </div>
                            <button onClick={() => handleCopy(cred.value, cred.id)} className="size-8 flex items-center justify-center rounded-lg hover:bg-amber-100 transition-colors">
                              {copiedField === cred.id ? <Check className="size-4 text-green-500" /> : <Copy className="size-4 text-[var(--fg-muted)]" />}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {!isEditingNotes ? (
                    account.notes && Object.keys(account.notes).length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(account.notes)
                          .filter(([key]) => key !== 'password' && key !== 'credentials')
                          .map(([key, value]) => (
                          <div key={key} className="flex flex-col p-3 bg-[var(--surface-light)] rounded-xl border border-[var(--border-soft)]">
                            <span className="text-[11px] font-bold text-[var(--fg-muted)] uppercase tracking-wider">{key}</span>
                            <span className="text-[14px] font-bold text-[var(--fg-base)] mt-1 font-mono break-all">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-[var(--fg-muted)] py-4 text-center border border-dashed border-[var(--border-soft)] rounded-xl bg-gray-50/50">
                        {sourceAccountText.noNotes}
                      </p>
                    )
                  ) : (
                    <div className="space-y-3">
                      {editedNotes.map((note, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input 
                            placeholder={sourceAccountText.noteKeyPlaceholder}
                            value={note.key}
                            onChange={(e) => handleUpdateNote(idx, 'key', e.target.value)}
                            className="flex-1 w-1/3 text-[13px] px-3 py-2 bg-white border border-[var(--border-soft)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                          />
                          <input 
                            placeholder={sourceAccountText.noteValuePlaceholder}
                            value={note.value}
                            onChange={(e) => handleUpdateNote(idx, 'value', e.target.value)}
                            className="flex-1 w-2/3 text-[13px] font-mono px-3 py-2 bg-white border border-[var(--border-soft)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                          />
                          <button onClick={() => handleRemoveNote(idx)} className="size-8 flex shrink-0 items-center justify-center text-[var(--danger)]/70 hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                      <Button variant="secondary" className="w-full border-dashed border-2 py-2 flex items-center justify-center gap-2" onClick={handleAddNote}>
                        <Plus className="size-4 text-[var(--fg-muted)]" /> {sourceAccountText.addNewField}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (Connections & Activity) */}
          <div className="lg:col-span-8 space-y-8">
            <div>
              <div ref={connectionsRef} className="app-card flex h-[550px] flex-col overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                {/* Tab header */}
                <div className="flex-shrink-0 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] p-6 z-10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[18px] font-black text-[var(--fg-base)] flex items-center gap-2 tracking-tight">
                      <Link2 className="size-5 text-[var(--accent)]" /> 
                      {sourceAccountText.connectionsTitle}
                    </h3>
                  </div>
                  {/* Tab buttons */}
                  <div className="flex items-center gap-1 bg-[var(--bg-app)] rounded-lg p-1 w-fit">
                    <button
                      onClick={() => setConnTab("manage")}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-[12px] font-bold transition-all",
                        connTab === "manage"
                          ? "bg-white text-[var(--fg-base)] shadow-sm"
                          : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                      )}
                    >
                      <Link2 className="size-3 inline-block mr-1.5 -mt-0.5" />
                      {sourceAccountText.manageTitle}
                    </button>
                    <button
                      onClick={() => setConnTab("detail")}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-[12px] font-bold transition-all",
                        connTab === "detail"
                          ? "bg-white text-[var(--fg-base)] shadow-sm"
                          : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                      )}
                    >
                      <Info className="size-3 inline-block mr-1.5 -mt-0.5" />
                      {sourceAccountText.detailTitle}
                    </button>
                    {/* Duolingo Family tab — only show if any product is Duolingo */}
                    {account.productIds.some(pid => (productMap.get(pid) ?? "").toLowerCase().includes("duolingo")) && (
                      <button
                        onClick={() => setConnTab("family")}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-[12px] font-bold transition-all",
                          connTab === "family"
                            ? "bg-white text-[var(--fg-base)] shadow-sm"
                            : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                        )}
                      >
                        {sourceAccountText.familyTitle}
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Tab content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-[var(--surface-light)]/30">
                  {connTab === "manage" ? (
                    <SourceAccountConnections 
                      sourceAccountId={account.id} 
                      maxSlots={account.maxSlots} 
                      usedSlots={account.usedSlots} 
                      productMap={productMap} 
                    />
                  ) : connTab === "family" ? (
                    <DuolingoFamilyPanel sourceAccountId={account.id} />
                  ) : (
                    <SourceAccountConnectionDetailsPanel sourceAccountId={account.id} productMap={productMap} />
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="app-card overflow-hidden border border-[var(--border-soft)] bg-[rgba(255,255,255,0.94)] shadow-[0_16px_38px_rgba(15,23,42,0.05)]">
                <div className="border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,250,244,0.84))] p-6">
                   <h3 className="text-[16px] font-black text-[var(--fg-base)] flex items-center gap-2 tracking-tight">
                      <Clock className="size-5 text-[var(--accent)]" /> 
                      {sourceAccountText.activityTitle}
                   </h3>
                </div>
                <div className="p-6 bg-[var(--surface-light)]/30">
                  <ActivityTimeline sourceAccountId={account.id} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </PageContainer>

      {/* Tái sử dụng modal Xóa từ Inventory */}
      <Modal isOpen={isDeleting} onClose={() => setIsDeleting(false)} title={sourceAccountText.deleteModalTitle} size="sm"
        footer={
          <div className="flex justify-end gap-3 flex-1">
            <Button variant="secondary" onClick={() => setIsDeleting(false)}>{sourceAccountText.cancel}</Button>
            <Button variant="primary" onClick={handleDelete} className="!bg-[var(--danger)] text-white hover:brightness-110 !font-bold">{sourceAccountText.deleteForever}</Button>
          </div>
        }
      >
        <div className="p-4 text-center">
          <div className="size-16 bg-[var(--danger)]/10 text-[var(--danger)] rounded-full flex justify-center items-center mx-auto mb-4">
             <Trash2 className="size-8" />
          </div>
          <p className="text-[16px] font-bold text-[var(--fg-base)] mb-2">{sourceAccountText.deleteModalQuestion}</p>
          <p className="text-[14px] text-[var(--fg-muted)]">{sourceAccountText.deleteModalWarning}</p>
        </div>
      </Modal>

      {/* ===== REUSE SHARED EDIT MODAL (same as inventory page) ===== */}
      {editingAccount && (
        <EditSourceAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          providers={providers}
          products={products}
          productMap={productMap}
          onSubmit={handleEditSubmit}
        />
      )}

    </AppLayout>
  );
}
