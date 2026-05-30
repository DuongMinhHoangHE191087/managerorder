"use client";

import React, { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/lib/toast";

interface ImageUploaderProps {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  placeholderType?: "avatar" | "icon" | "image";
  className?: string;
}

export function ImageUploader({
  value,
  onChange,
  placeholderType = "image",
  className,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (file.size > 5 * 1024 * 1024) {
        appToast.error("File quá lớn. Tối đa 5MB.");
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Upload thất bại");
        }

        const data = await res.json();
        onChange(data.url);
        appToast.success("Tải ảnh lên thành công!");
      } catch (error) {
        appToast.error(error instanceof Error ? error.message : "Không thể tải ảnh lên");
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onChange]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
    },
    [onChange]
  );

  return (
    <div
      onClick={() => !uploading && fileInputRef.current?.click()}
      className={cn(
        "group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-[var(--accent)]/50 transition-all duration-205 select-none shrink-0",
        placeholderType === "avatar" ? "h-20 w-20 rounded-full" : "h-16 w-16 rounded-xl",
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <>
          <img
            src={value}
            alt="Uploaded asset"
            className="size-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          >
            <X className="size-3" />
          </button>
        </>
      ) : uploading ? (
        <div className="flex flex-col items-center justify-center gap-1.5 p-2">
          <Loader2 className="size-4 animate-spin text-[var(--accent)]" />
          <span className="text-[9px] font-bold text-gray-500">Đang tải...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1 p-2 text-center text-gray-400 group-hover:text-gray-600 transition-colors">
          <Upload className="size-4 opacity-70 group-hover:scale-110 transition-transform" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Tải lên</span>
        </div>
      )}
    </div>
  );
}
