"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Upload, ChevronRight, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, RotateCcw, ExternalLink } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";
import { formatNumber } from "@/lib/utils";
import { loadWorkbook, worksheetToMatrix } from "@/lib/utils/excel";

import { AppLayout } from "@/widgets/layout/app-layout";
import { PageContainer } from "@/shared/ui/page-layout";
import { vi } from "@/shared/messages/vi";

// Dynamic imports — heavy components only shown in specific wizard steps
const ImportMappingGrid = dynamic(() => import("@/widgets/pages/orders/components/import-mapping-grid").then(m => m.ImportMappingGrid), { ssr: false });
const ImportPreviewTable = dynamic(() => import("@/widgets/pages/orders/components/import-preview-table").then(m => m.ImportPreviewTable), { ssr: false });
import type { ParsedOrder } from "@/widgets/pages/orders/components/import-preview-table";
import {
  ORDER_IMPORT_FIELDS,
  DUOLINGO_EXTRA_FIELDS,
  CONTACT_CHANNEL_OPTIONS,
  detectHeaderRowIndex,
  fuzzyMatchHeaders,
  extractMappedData,
  safeStringify,
  type TargetField,
  type ContactChannelKey,
  type ImportDefaultValues,
} from "@/lib/utils";

// Steps for the import wizard
const STEPS = [
  { id: 1, label: vi.orders.importPage.steps.upload, icon: Upload },
  { id: 2, label: vi.orders.importPage.steps.mapping, icon: FileSpreadsheet },
  { id: 3, label: vi.orders.importPage.steps.preview, icon: CheckCircle2 },
] as const;


export default function ImportOrdersPage() {
  const importText = vi.orders.importPage;
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState(1);

  // File state
  const [fileName, setFileName] = useState("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [workbook, setWorkbook] = useState<any>(null);
  const [rawExcelData, setRawExcelData] = useState<unknown[][]>([]);

  // Mapping state
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number | undefined>>({});
  const [dynamicContactFields, setDynamicContactFields] = useState<TargetField[]>([]);
  const [dynamicDuolingoFields, setDynamicDuolingoFields] = useState<TargetField[]>([]);
  const [defaultValues, setDefaultValues] = useState<ImportDefaultValues>({ quantity: 1 });

  // Preview/import state
  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importResult, setImportResult] = useState<Record<string, any> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Reset all state for fresh import ---
  const resetState = useCallback(() => {
    setStep(1);
    setFileName("");
    setSheetNames([]);
    setSelectedSheet("");
    setWorkbook(null);
    setRawExcelData([]);
    setHeaderRowIndex(0);
    setMapping({});
    setDynamicContactFields([]);
    setDynamicDuolingoFields([]);
    setDefaultValues({ quantity: 1 });
    setParsedOrders([]);
    setIsImporting(false);
    setIsDragging(false);
    setImportResult(null);
    // Clear file input element
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // Current headers based on selected header row
  const currentHeaders = useMemo(() => {
    if (!rawExcelData.length || headerRowIndex >= rawExcelData.length) return [];
    const row = rawExcelData[headerRowIndex];
    return row.map((cell, i) => ({
      index: i,
      text: safeStringify(cell) || `Cột ${i + 1}`,
    })).filter(h => h.text.trim().length > 0);
  }, [rawExcelData, headerRowIndex]);

  // --- File handling ---
  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const wb = await loadWorkbook(data ?? new ArrayBuffer(0));
        setWorkbook(wb);
        const firstSheet = wb.worksheets[0];
        const sheetNames = wb.worksheets.map((sheet) => sheet.name);
        setSheetNames(sheetNames);
        setSelectedSheet(firstSheet?.name ?? "");

        if (!firstSheet) {
          appToast.error(importText.fileWithoutSheet);
          return;
        }

        // Parse first sheet
        const jsonData = worksheetToMatrix(firstSheet);
        setRawExcelData(jsonData);

        // Auto-detect header & mapping (include duolingo extra fields)
        const headerIdx = detectHeaderRowIndex(jsonData as string[][]);
        setHeaderRowIndex(headerIdx);
        const headers = (jsonData[headerIdx] as string[]).map(h => safeStringify(h));
        const autoMapping = fuzzyMatchHeaders(headers, DUOLINGO_EXTRA_FIELDS);
        setMapping(autoMapping);

        // Auto-add duolingo fields that were matched
        const matchedDuoFields = DUOLINGO_EXTRA_FIELDS.filter((f: TargetField) => autoMapping[f.key] !== undefined);
        setDynamicDuolingoFields(matchedDuoFields);

        setStep(2);
        appToast.success(importText.fileUploaded);
      } catch {
        appToast.error(importText.fileReadError);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // --- Sheet change ---
  const handleSheetChange = useCallback(async (sheetName: string) => {
    if (!workbook) return;
    setSelectedSheet(sheetName);
    const ws = workbook.getWorksheet(sheetName);
    if (!ws) {
      appToast.error(importText.sheetNotFound);
      return;
    }
    const jsonData = worksheetToMatrix(ws);
    setRawExcelData(jsonData);
    const headerIdx = detectHeaderRowIndex(jsonData as string[][]);
    setHeaderRowIndex(headerIdx);
    const headers = (jsonData[headerIdx] as string[]).map(h => safeStringify(h));
    const autoMapping = fuzzyMatchHeaders(headers, DUOLINGO_EXTRA_FIELDS);
    setMapping(autoMapping);
    // Auto-add duolingo fields that were matched
    const matchedDuoFields = DUOLINGO_EXTRA_FIELDS.filter((f: TargetField) => autoMapping[f.key] !== undefined);
    setDynamicDuolingoFields(matchedDuoFields);
  }, [workbook]);

  // --- Dynamic contact fields ---
  const handleAddContactField = useCallback((channel: ContactChannelKey) => {
    const channelOpt = CONTACT_CHANNEL_OPTIONS.find(c => c.key === channel);
    if (!channelOpt) return;

    const newField: TargetField = {
      key: `dynamic_${channel}_${Date.now()}`,
      label: channelOpt.label,
      required: false,
      type: 'string',
      group: 'contact',
      contactChannel: channel,
      aliases: [channel, channelOpt.label.toLowerCase()],
    };
    setDynamicContactFields(prev => [...prev, newField]);
  }, []);

  const handleRemoveContactField = useCallback((key: string) => {
    setDynamicContactFields(prev => prev.filter(f => f.key !== key));
    setMapping(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // --- Dynamic duolingo fields ---
  const handleAddDuolingoField = useCallback((fieldKey: string) => {
    const extraField = DUOLINGO_EXTRA_FIELDS.find((f: TargetField) => f.key === fieldKey);
    if (!extraField) return;
    setDynamicDuolingoFields(prev => [...prev, extraField]);
  }, []);

  const handleRemoveDuolingoField = useCallback((key: string) => {
    setDynamicDuolingoFields(prev => prev.filter((f: TargetField) => f.key !== key));
    setMapping(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // --- Mapping change ---
  const handleMappingChange = useCallback((targetKey: string, excelColIndex: string) => {
    setMapping(prev => ({
      ...prev,
      [targetKey]: excelColIndex === "" ? undefined : Number(excelColIndex),
    }));
  }, []);

  const handleHeaderRowChange = useCallback((index: number) => {
    setHeaderRowIndex(index);
    if (rawExcelData.length > index) {
      const headers = (rawExcelData[index] as string[]).map(h => safeStringify(h));
      setMapping(fuzzyMatchHeaders(headers));
    }
  }, [rawExcelData]);

  // --- Parse & Preview ---
  const handleParsePreview = useCallback(() => {
    const allFields = [...ORDER_IMPORT_FIELDS, ...dynamicContactFields, ...dynamicDuolingoFields];
    const parsed = extractMappedData(rawExcelData as unknown[][], headerRowIndex, mapping, defaultValues, allFields);
    setParsedOrders(parsed as ParsedOrder[]);
    setStep(3);
  }, [rawExcelData, headerRowIndex, mapping, dynamicContactFields, dynamicDuolingoFields, defaultValues]);

  // --- Import execution (chunked for large datasets up to 20,000) ---
  const MAX_IMPORT = 20_000;

  const handleImport = useCallback(async () => {
    const validOrders = parsedOrders.filter(o => !o._error);
    if (validOrders.length === 0) {
      appToast.error(importText.noValidOrders);
      return;
    }

    if (validOrders.length > MAX_IMPORT) {
      appToast.error(importText.tooManyOrders(validOrders.length, formatNumber(MAX_IMPORT)));
      return;
    }

    setIsImporting(true);
    appToast.loading(importText.importLoading(validOrders.length), { id: "import-progress" });

    try {
      const res = await fetch("/api/orders/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validOrders),
      });
      const result = await res.json();

      if (res.ok && result.success) {
        const details = [
          `${result.importedCount} ${importText.importedCount}`,
          result.customersCreated > 0 ? `${result.customersCreated} ${importText.customersNew}` : null,
          result.ctvCreated > 0 ? `${result.ctvCreated} ${importText.ctvNew}` : null,
          result.productsCreated > 0 ? `${result.productsCreated} ${importText.productsNew}` : null,
          result.skippedRows?.length > 0 ? `${result.skippedRows.length} ${importText.skippedRows}` : null,
        ].filter(Boolean).join(', ');
        appToast.success(`${importText.importedSuccessTitle}: ${details}`, { id: "import-progress" });
        setImportResult(result);
        setStep(4); // Step 4 = success view
      } else if (res.status === 422) {
        const msgs = (result.validationErrors || []).slice(0, 5)
          .map((e: { row: number; message: string }) => `${importText.rowPrefix} ${e.row}: ${e.message}`)
          .join('\n');
        appToast.error(`${importText.validationErrorTitle}:\n${msgs}`, { id: "import-progress" });
      } else {
        appToast.error(`${importText.importFailed}: ${result.details || result.error}`, { id: "import-progress" });
      }
    } catch (err) {
      appToast.error(`${importText.connectionError}: ${err instanceof Error ? err.message : importText.unknownError}`, { id: "import-progress" });
    } finally {
      setIsImporting(false);
    }
  }, [parsedOrders]);

  // --- Stats for preview ---
  const stats = useMemo(() => {
    const total = parsedOrders.length;
    const valid = parsedOrders.filter(o => !o._error).length;
    const errors = total - valid;
    return { total, valid, errors };
  }, [parsedOrders]);

  return (
    <AppLayout>
      <PageContainer variant="narrow">
        {/* Top bar */}
        <div className="flex items-center gap-4">
          <Link
            href="/orders"
            className="flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors"
          >
            <ArrowLeft className="size-4" />
            {importText.backToOrders}
          </Link>
        </div>

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--fg-base)] tracking-tight">{importText.title}</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            {importText.description}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-[var(--border-soft)] p-4 shadow-sm">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            return (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all flex-1 ${
                    isActive
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-bold'
                      : isCompleted
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'text-[var(--fg-muted)]'
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="text-sm">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="size-4 text-[var(--fg-muted)] shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: File Upload */}
        {step === 1 && (
          <div
            className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all ${
              isDragging
                ? 'border-[var(--accent)] bg-[var(--accent)]/5 scale-[1.01]'
                : 'border-[var(--border-soft)] hover:border-[var(--accent)]/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="size-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                <Upload className="size-8 text-[var(--accent)]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--fg-base)]">
                  {importText.uploadTitle}
                </h3>
                <p className="text-sm text-[var(--fg-muted)] mt-1">
                  {importText.uploadDescription}
                </p>
              </div>
              <label className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium cursor-pointer hover:opacity-90 transition-opacity">
                {importText.uploadButton}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 2 && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <FileSpreadsheet className="size-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">{fileName}</span>
              <span className="text-xs text-emerald-500 ml-auto">{importText.dataRows(rawExcelData.length - 1)}</span>
            </div>

            <ImportMappingGrid
              sheetNames={sheetNames}
              selectedSheet={selectedSheet}
              onSheetChange={handleSheetChange}
              rawExcelData={rawExcelData}
              headerRowIndex={headerRowIndex}
              onHeaderRowChange={handleHeaderRowChange}
              mapping={mapping}
              onMappingChange={handleMappingChange}
              currentHeaders={currentHeaders}
              dynamicContactFields={dynamicContactFields}
              onAddContactField={handleAddContactField}
              onRemoveContactField={handleRemoveContactField}
              dynamicDuolingoFields={dynamicDuolingoFields}
              onAddDuolingoField={handleAddDuolingoField}
              onRemoveDuolingoField={handleRemoveDuolingoField}
              defaultValues={defaultValues}
              onDefaultValuesChange={setDefaultValues}
            />

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-[var(--border-soft)]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors"
              >
                {importText.backToStep2}
              </button>
              <button
                type="button"
                onClick={handleParsePreview}
                className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                {importText.previewButton}
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview & Import */}
        {/* Step 4: Import Success */}
        {step === 4 && importResult && (
          <div className="space-y-6">
            {/* Success header */}
            <div className="text-center py-8">
              <div className="size-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="size-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--fg-base)]">{importText.importedSuccessTitle}</h2>
              <p className="text-[var(--fg-muted)] mt-2">
                {importText.importedSuccessDescription(importResult.importedCount, fileName)}
              </p>
            </div>

            {/* Result stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{importResult.importedCount}</div>
                <div className="text-xs text-emerald-500 mt-1">{importText.importedCount}</div>
              </div>
              {importResult.customersCreated > 0 && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResult.customersCreated}</div>
                  <div className="text-xs text-blue-500 mt-1">{importText.customersNew}</div>
                </div>
              )}
              {importResult.productsCreated > 0 && (
                <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{importResult.productsCreated}</div>
                  <div className="text-xs text-purple-500 mt-1">{importText.productsNew}</div>
                </div>
              )}
              {importResult.skippedRows?.length > 0 && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{importResult.skippedRows.length}</div>
                  <div className="text-xs text-amber-500 mt-1">{importText.skippedRows}</div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-center gap-4 pt-4">
              <button
                type="button"
                onClick={resetState}
                className="px-6 py-3 bg-white border border-[var(--border-soft)] rounded-lg font-bold text-[var(--fg-base)] hover:bg-gray-50 transition-all flex items-center gap-2 shadow-sm"
              >
                <RotateCcw className="size-4" />
                {importText.importAgain}
              </button>
              <button
                type="button"
                onClick={() => router.push("/orders")}
                className="px-6 py-3 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-white rounded-lg font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg"
              >
                <ExternalLink className="size-4" />
                {importText.viewOrders}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-[var(--border-soft)] p-4 text-center">
                <div className="text-2xl font-bold text-[var(--fg-base)]">{stats.total}</div>
                <div className="text-xs text-[var(--fg-muted)] mt-1">{importText.totalOrders}</div>
              </div>
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{stats.valid}</div>
                <div className="text-xs text-emerald-500 mt-1">{importText.valid}</div>
              </div>
              <div className={`rounded-xl border p-4 text-center ${
                stats.errors > 0
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-[var(--border-soft)]'
              }`}>
                <div className={`text-2xl font-bold ${stats.errors > 0 ? 'text-red-600' : 'text-[var(--fg-muted)]'}`}>
                  {stats.errors}
                </div>
                <div className={`text-xs mt-1 ${stats.errors > 0 ? 'text-red-500' : 'text-[var(--fg-muted)]'}`}>
                  {importText.errors}
                </div>
              </div>
            </div>

            {stats.errors > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  {importText.errorsNotice(stats.errors, stats.valid)}
                </p>
              </div>
            )}

            {/* Preview table */}
            <ImportPreviewTable data={parsedOrders} />

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-[var(--border-soft)]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg-base)] transition-colors"
              >
                {importText.backToStep2}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || stats.valid === 0}
                className="px-8 py-3 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)] text-white rounded-lg font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {importText.importing}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    {importText.importOrders(stats.valid)}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
