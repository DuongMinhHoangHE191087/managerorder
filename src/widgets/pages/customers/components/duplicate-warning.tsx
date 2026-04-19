"use client";

import { AlertTriangle, ExternalLink, UserCheck } from "lucide-react";
import type { DuplicateCandidate } from "@/shared/types/customers";

interface DuplicateWarningProps {
  duplicates: DuplicateCandidate[];
  onContinue: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DuplicateWarning({ duplicates, onContinue, onCancel, isSubmitting }: DuplicateWarningProps) {
  if (duplicates.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-3">
        <div className="size-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
          <AlertTriangle className="size-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[14px] font-bold text-amber-800 mb-1">
            Phát hiện {duplicates.length} khách hàng có thể trùng lặp
          </h4>
          <p className="text-[12px] text-amber-700 mb-3">
            Kiểm tra danh sách bên dưới trước khi tiếp tục tạo mới.
          </p>

          <div className="space-y-2 mb-4">
            {duplicates.map(dup => (
              <div
                key={dup.id}
                className="flex items-center gap-3 bg-white border border-amber-200 rounded-lg px-3 py-2"
              >
                <UserCheck className="size-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[var(--fg-base)] truncate">{dup.name}</p>
                  <p className="text-[11px] text-[var(--fg-muted)]">
                    {dup.matchType === "name" && `Tên tương tự (${(dup.similarity * 100).toFixed(0)}%)`}
                    {dup.matchType === "contact" && `Trùng liên hệ: ${dup.matchValue}`}
                    {dup.matchType === "both" && `Trùng tên + liên hệ: ${dup.matchValue}`}
                  </p>
                </div>
                <a
                  href={`/customers/${dup.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] hover:text-[var(--accent-strong)] p-1"
                  title="Xem chi tiết"
                >
                  <ExternalLink className="size-4" />
                </a>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-[12px] font-bold text-[var(--fg-muted)] border border-[var(--border-soft)] rounded-lg hover:bg-gray-50 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={isSubmitting}
              className="px-4 py-2 text-[12px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Đang tạo..." : "Vẫn tạo mới"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
