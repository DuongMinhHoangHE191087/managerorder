"use client";

import { useState, useId, useCallback, useEffect, useRef } from "react";
import { Loader2, X, ImagePlus, Image as ImageIcon } from "lucide-react";
import { appToast } from "@/shared/ui/app-toast";

interface ProofFile { id: string; file?: File; url: string; uploading: boolean; error?: string; }

export function ProofUploader({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const [files, setFiles] = useState<ProofFile[]>(
    value.map(url => ({ id: url, url, uploading: false }))
  );
  const prevValueRef = useRef(value);

  // Sync internal state when parent resets value (e.g. after order creation)
  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    // Parent cleared all images → reset internal files + revoke blob URLs
    if (value.length === 0 && prev.length > 0) {
      setFiles(current => {
        current.forEach(f => { if (f.file) URL.revokeObjectURL(f.url); });
        return [];
      });
    }
  }, [value]);
  
  const fileId = useId();
  const MAX = 5;

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json() as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
    return data.url;
  }, []);

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const available = MAX - files.length;
    const toAdd = picked.slice(0, available);
    if (picked.length > available) appToast.warning(`Chỉ có thể thêm ${available} ảnh nữa (tối đa ${MAX})`);

    const newFiles: ProofFile[] = toAdd.map(f => ({ id: `${Date.now()}_${f.name}`, file: f, url: URL.createObjectURL(f), uploading: true }));
    setFiles(prev => [...prev, ...newFiles]);
    e.target.value = "";

    const uploadPromises = newFiles.map(async pf => {
      try {
        const url = await uploadFile(pf.file!);
        setFiles(prev => prev.map(x => x.id === pf.id ? { ...x, url, uploading: false } : x));
        return { id: pf.id, url };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload lỗi";
        setFiles(prev => prev.map(x => x.id === pf.id ? { ...x, uploading: false, error: msg } : x));
        appToast.error(`Upload thất bại: ${msg}`);
        return null;
      }
    });
    await Promise.all(uploadPromises);

    setFiles(cur => {
      const validUrls = cur.filter(x => !x.uploading && !x.error).map(x => x.url);
      Promise.resolve().then(() => onChange(validUrls));
      return cur;
    });
  };

  const handleRemove = (id: string) => {
    setFiles(prev => {
      const next = prev.filter(x => x.id !== id);
      const validUrls = next.filter(x => !x.uploading && !x.error).map(x => x.url);
      Promise.resolve().then(() => onChange(validUrls));
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {files.map(f => (
          <div key={f.id} className="relative size-20 rounded-xl overflow-hidden border-2 border-[var(--border-soft)] group shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="proof" className={`size-full object-cover transition-all ${f.uploading ? "opacity-40 blur-sm" : ""}`} />
            {f.uploading && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="size-5 text-white animate-spin" /></div>}
            {f.error && <div className="absolute inset-0 flex items-center justify-center bg-red-500/80 text-white text-[9px] text-center p-1 font-bold">{f.error}</div>}
            {!f.uploading && (
              <button type="button" onClick={() => handleRemove(f.id)} className="absolute top-1 right-1 size-5 bg-[var(--danger)] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white shadow-lg">
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
        {files.length < MAX && (
          <label htmlFor={fileId} className="size-20 rounded-xl border-2 border-dashed border-[var(--border-soft)] hover:border-[var(--accent)] bg-[var(--bg-app)]/40 hover:bg-[var(--accent)]/5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all group">
            <ImagePlus className="size-6 text-[var(--fg-muted)] group-hover:text-[var(--accent)] transition-colors" />
            <span className="text-[9px] font-bold text-[var(--fg-muted)] group-hover:text-[var(--accent)] uppercase tracking-wider">{files.length}/{MAX}</span>
            <input id={fileId} type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleAdd} />
          </label>
        )}
      </div>
      {files.length > 0 && (
        <p className="text-[11px] text-[var(--fg-muted)] font-medium flex items-center gap-1">
          <ImageIcon className="size-3.5" />
          {files.filter(f => !f.uploading && !f.error).length} ảnh đã tải lên • {files.filter(f => f.uploading).length > 0 ? "Đang upload..." : "Hoàn tất"}
        </p>
      )}
    </div>
  );
}
